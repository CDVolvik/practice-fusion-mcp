import type { FhirReader, FhirResource } from "../fhir/client.js";
import { demoResources } from "./fixtures.js";

/** Extract the referenced Patient id from whichever field a resource uses to
 *  point at its patient (subject / patient / beneficiary / appointment actor). */
function patientIdOf(r: FhirResource): string | undefined {
  const a = r as Record<string, any>;
  const ref: unknown =
    a.subject?.reference ??
    a.patient?.reference ??
    a.beneficiary?.reference ??
    a.participant?.find((p: any) => p.actor?.reference?.startsWith?.("Patient/"))?.actor?.reference;
  return typeof ref === "string" && ref.startsWith("Patient/")
    ? ref.slice("Patient/".length)
    : undefined;
}

function displayName(r: FhirResource): string {
  const n = (r as Record<string, any>).name?.[0];
  return n ? [n.given?.join(" "), n.family].filter(Boolean).join(" ") : "";
}

function hasIdentifier(r: FhirResource, value: string): boolean {
  const ids = (r as Record<string, any>).identifier;
  return Array.isArray(ids) && ids.some((i: any) => i?.value === value);
}

function observationCategories(r: FhirResource): string[] {
  const cats = (r as Record<string, any>).category;
  if (!Array.isArray(cats)) return [];
  return cats.flatMap((c: any) => (c?.coding ?? []).map((code: any) => code?.code)).filter(Boolean);
}

/** Compare a FHIR date-prefixed filter (e.g. `ge2026-07-01`) against a value. */
function matchesDateFilter(value: string | undefined, filter: string): boolean {
  if (!value) return false;
  const m = /^(eq|ne|ge|le|gt|lt)?(.+)$/.exec(filter);
  if (!m) return false;
  const [, prefix = "eq", date] = m;
  const a = value.slice(0, date.length);
  switch (prefix) {
    case "ge":
      return a >= date;
    case "le":
      return a <= date;
    case "gt":
      return a > date;
    case "lt":
      return a < date;
    case "ne":
      return a !== date;
    default:
      return a === date;
  }
}

/**
 * A {@link FhirReader} backed by in-memory synthetic fixtures instead of a live
 * Practice Fusion API. Powers `--demo` mode: the tools call it exactly as they
 * call the real client, so an evaluator can run every tool with no credentials
 * and no PHI. Supports the search parameters the tools actually send —
 * `patient`, `name`, `birthdate`, `gender`, `identifier`, `category`, `status`,
 * and the appointment `date` filter.
 */
export class FixtureFhirClient implements FhirReader {
  constructor(private readonly resources: FhirResource[] = demoResources) {}

  search(
    resourceType: string,
    params: Record<string, string>,
    opts: { limit?: number } = {},
  ): Promise<FhirResource[]> {
    let hits = this.resources.filter((r) => r.resourceType === resourceType);

    if (params.patient) hits = hits.filter((r) => patientIdOf(r) === params.patient);
    if (params.category)
      hits = hits.filter((r) => observationCategories(r).includes(params.category));
    if (params.name) {
      const q = params.name.toLowerCase();
      hits = hits.filter((r) => displayName(r).toLowerCase().includes(q));
    }
    if (params.birthdate)
      hits = hits.filter((r) => (r as Record<string, any>).birthDate === params.birthdate);
    if (params.gender)
      hits = hits.filter((r) => (r as Record<string, any>).gender === params.gender);
    if (params.identifier) hits = hits.filter((r) => hasIdentifier(r, params.identifier));
    if (params.status)
      hits = hits.filter((r) => (r as Record<string, any>).status === params.status);
    if (params.date)
      hits = hits.filter((r) => matchesDateFilter((r as Record<string, any>).start, params.date));

    // Return at most one past the caller's limit, matching the real client, so
    // `paged()` can report has_more correctly.
    const limit = opts.limit;
    const bounded = limit === undefined ? hits : hits.slice(0, limit + 1);
    return Promise.resolve(bounded);
  }

  read(resourceType: string, id: string): Promise<FhirResource> {
    const hit = this.resources.find((r) => r.resourceType === resourceType && r.id === id);
    if (!hit) {
      // Mirror the real client's error shape so error-path handling is exercised.
      return Promise.reject(
        new Error(`FHIR request failed: 404 (${resourceType}/${id} not found)`),
      );
    }
    return Promise.resolve(hit);
  }

  everything(
    patientId: string,
    opts: { types?: string[]; since?: string; limit?: number } = {},
  ): Promise<FhirResource[]> {
    const limit = opts.limit ?? 200;
    let hits = this.resources.filter((r) => patientIdOf(r) === patientId);
    if (opts.types) hits = hits.filter((r) => opts.types!.includes(r.resourceType));
    return Promise.resolve(hits.slice(0, limit));
  }
}
