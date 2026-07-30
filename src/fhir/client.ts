export interface FhirResource {
  resourceType: string;
  id?: string;
  [key: string]: unknown;
}

interface Bundle {
  resourceType: "Bundle";
  entry?: { resource?: FhirResource }[];
  link?: { relation: string; url: string }[];
}

interface TokenSource {
  getAccessToken(): Promise<string>;
}

/**
 * The read surface the tools depend on. `FhirClient` talks to a live Practice
 * Fusion FHIR API; the demo fixture client implements the same three methods
 * against in-memory synthetic data, so tools work identically either way.
 */
export interface FhirReader {
  search(
    resourceType: string,
    params: Record<string, string>,
    opts?: { limit?: number },
  ): Promise<FhirResource[]>;
  read(resourceType: string, id: string): Promise<FhirResource>;
  everything(
    patientId: string,
    opts?: { types?: string[]; since?: string; limit?: number },
  ): Promise<FhirResource[]>;
}

/** Resource types the $everything fallback loops over. Matches the surface
 *  of the existing practicefusion_get_* tools, so the fallback is symmetric
 *  with what users get by calling the typed tools directly. */
const EVERYTHING_FALLBACK_TYPES = [
  "Condition",
  "MedicationRequest",
  "Observation",
  "AllergyIntolerance",
  "Immunization",
  "Appointment",
  "Encounter",
  "DocumentReference",
  "Coverage",
  "Procedure",
  "DiagnosticReport",
  "CarePlan",
  "Goal",
] as const;

/** True if an error from `get()` means the server does not implement the
 *  `$everything` operation (vs. an auth/network problem the caller should
 *  see). 404 (route not registered) and 422 (unprocessable: the server
 *  doesn't understand the operation on this resource) are the two cases
 *  the FHIR spec surfaces. */
function isOperationUnsupported(e: unknown): boolean {
  const msg = e instanceof Error ? e.message : String(e);
  return /FHIR request failed: (404|422)/.test(msg);
}

export interface FhirClientOptions {
  retryMaxAttempts?: number;
  retryBaseMs?: number;
  retryCapMs?: number;
  /** Override sleep — exposed for tests. */
  sleep?: (ms: number) => Promise<void>;
}

export class FhirClient implements FhirReader {
  private readonly retryMaxAttempts: number;
  private readonly retryBaseMs: number;
  private readonly retryCapMs: number;
  private readonly sleep: (ms: number) => Promise<void>;

  constructor(
    private readonly baseUrl: string,
    private readonly tokens: TokenSource,
    options: FhirClientOptions = {},
  ) {
    this.retryMaxAttempts = options.retryMaxAttempts ?? 4;
    this.retryBaseMs = options.retryBaseMs ?? 500;
    this.retryCapMs = options.retryCapMs ?? 8000;
    this.sleep = options.sleep ?? ((ms) => new Promise((r) => setTimeout(r, ms)));
  }

  async search(
    resourceType: string,
    params: Record<string, string>,
    opts: { limit?: number } = {},
  ): Promise<FhirResource[]> {
    const qs = new URLSearchParams(params).toString();
    let url: string | undefined = `${this.baseUrl}/${resourceType}${qs ? `?${qs}` : ""}`;
    const resources: FhirResource[] = [];
    const MAX_PAGES = 50;
    for (let page = 0; url && page < MAX_PAGES; page++) {
      const bundle = (await this.get(url)) as Bundle;
      for (const e of bundle.entry ?? []) {
        if (e.resource) resources.push(e.resource);
      }
      // Stop paging once we have one more than the caller asked for, so a broad
      // query can't pull the whole dataset into memory.
      if (opts.limit !== undefined && resources.length > opts.limit) break;
      url = bundle.link?.find((l) => l.relation === "next")?.url;
    }
    return resources;
  }

  async read(resourceType: string, id: string): Promise<FhirResource> {
    return (await this.get(
      `${this.baseUrl}/${resourceType}/${encodeURIComponent(id)}`,
    )) as FhirResource;
  }

  /**
   * FHIR `$everything` on a Patient — returns every resource linked to that
   * patient as a flat list. Tries the canonical operation first; if the
   * server returns 404 or 422 (e.g. Practice Fusion's Open FHIR does not
   * support `$everything`), falls back to looping `search()` over the
   * requested resource types. Hard-caps the total returned so a single
   * call cannot exhaust context.
   */
  async everything(
    patientId: string,
    opts: { types?: string[]; since?: string; limit?: number } = {},
  ): Promise<FhirResource[]> {
    const limit = opts.limit ?? 200;
    const types = opts.types ?? EVERYTHING_FALLBACK_TYPES;
    try {
      const qs = new URLSearchParams();
      if (opts.types) qs.set("_type", opts.types.join(","));
      if (opts.since) qs.set("_since", opts.since);
      const url = `${this.baseUrl}/Patient/${encodeURIComponent(patientId)}/$everything${qs.toString() ? `?${qs}` : ""}`;
      return await this.fetchBundleFlat(url, limit);
    } catch (e) {
      if (!isOperationUnsupported(e)) throw e;
      // Fallback: search each type individually.
      const out: FhirResource[] = [];
      for (const t of types) {
        if (out.length >= limit) break;
        const params: Record<string, string> = { patient: patientId };
        if (opts.since) params._lastUpdated = `ge${opts.since}`;
        const r = await this.search(t, params, { limit: limit - out.length });
        out.push(...r);
      }
      return out;
    }
  }

  /** Walk a Bundle-returning URL (any FHIR operation that returns a Bundle),
   *  flattening entries until `limit` resources have been collected. */
  private async fetchBundleFlat(url: string, limit: number): Promise<FhirResource[]> {
    const out: FhirResource[] = [];
    const MAX_PAGES = 50;
    let next: string | undefined = url;
    for (let page = 0; next && page < MAX_PAGES; page++) {
      const bundle = (await this.get(next)) as Bundle;
      for (const e of bundle.entry ?? []) {
        if (e.resource) out.push(e.resource);
        if (out.length >= limit) return out;
      }
      next = bundle.link?.find((l) => l.relation === "next")?.url;
    }
    return out;
  }

  private async get(url: string): Promise<unknown> {
    const { withRetry } = await import("./retry.js");
    const result = await withRetry(
      async () => {
        const token = await this.tokens.getAccessToken();
        const res = await fetch(url, {
          headers: { Authorization: `Bearer ${token}`, Accept: "application/fhir+json" },
        });
        const body = await res.text();
        return {
          status: res.status,
          body,
          headers: res.headers,
          value: () => JSON.parse(body) as unknown,
        };
      },
      {
        maxAttempts: this.retryMaxAttempts,
        baseMs: this.retryBaseMs,
        capMs: this.retryCapMs,
        sleep: this.sleep,
      },
    );
    return result.value;
  }
}
