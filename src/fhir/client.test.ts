import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { FhirClient } from "./client.js";

const tokenProvider = { getAccessToken: async () => "tok-1" };
const noSleep = (): Promise<void> => Promise.resolve();

describe("FhirClient", () => {
  const fetchMock = vi.fn();
  beforeEach(() => {
    fetchMock.mockClear();
    vi.stubGlobal("fetch", fetchMock);
  });
  afterEach(() => vi.unstubAllGlobals());

  it("search() returns the resources from a searchset Bundle", async () => {
    fetchMock.mockResolvedValue(
      new Response(
        JSON.stringify({
          resourceType: "Bundle",
          type: "searchset",
          entry: [
            { resource: { resourceType: "Patient", id: "p1" } },
            { resource: { resourceType: "Patient", id: "p2" } },
          ],
        }),
        { status: 200 },
      ),
    );
    const client = new FhirClient("https://fhir.example.com/r4", tokenProvider, { sleep: noSleep });
    const result = await client.search("Patient", { name: "smith" });

    expect(result.map((r) => r.id)).toEqual(["p1", "p2"]);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("https://fhir.example.com/r4/Patient?name=smith");
    expect((init.headers as Record<string, string>).Authorization).toBe("Bearer tok-1");
  });

  it("search() returns [] when the Bundle has no entries", async () => {
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify({ resourceType: "Bundle", type: "searchset" }), { status: 200 }),
    );
    const client = new FhirClient("https://fhir.example.com/r4", tokenProvider, { sleep: noSleep });
    expect(await client.search("Condition", { patient: "p1" })).toEqual([]);
  });

  it("read() returns a single resource", async () => {
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify({ resourceType: "Patient", id: "p1" }), { status: 200 }),
    );
    const client = new FhirClient("https://fhir.example.com/r4", tokenProvider, { sleep: noSleep });
    const patient = await client.read("Patient", "p1");
    expect(patient.id).toBe("p1");
    expect(fetchMock.mock.calls[0][0]).toBe("https://fhir.example.com/r4/Patient/p1");
  });

  it("throws a sanitized error on a non-2xx response", async () => {
    fetchMock.mockResolvedValue(new Response("boom", { status: 403 }));
    const client = new FhirClient("https://fhir.example.com/r4", tokenProvider, { sleep: noSleep });
    await expect(client.read("Patient", "p1")).rejects.toThrow(/FHIR request failed: 403/);
  });

  it("search() follows Bundle 'next' links across pages", async () => {
    fetchMock
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            resourceType: "Bundle",
            type: "searchset",
            entry: [{ resource: { resourceType: "Patient", id: "p1" } }],
            link: [{ relation: "next", url: "https://fhir.example.com/r4/Patient?page=2" }],
          }),
          { status: 200 },
        ),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            resourceType: "Bundle",
            type: "searchset",
            entry: [{ resource: { resourceType: "Patient", id: "p2" } }],
          }),
          { status: 200 },
        ),
      );
    const client = new FhirClient("https://fhir.example.com/r4", tokenProvider, { sleep: noSleep });
    const result = await client.search("Patient", { name: "smith" });
    expect(result.map((r) => r.id)).toEqual(["p1", "p2"]);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock.mock.calls[1][0]).toBe("https://fhir.example.com/r4/Patient?page=2");
  });

  it("retries 503 then succeeds (read)", async () => {
    fetchMock
      .mockResolvedValueOnce(new Response("Service Unavailable", { status: 503 }))
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ resourceType: "Patient", id: "p1" }), { status: 200 }),
      );
    const client = new FhirClient("https://fhir.example.com/r4", tokenProvider, { sleep: noSleep });
    const patient = await client.read("Patient", "p1");
    expect(patient.id).toBe("p1");
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("retries 429 with Retry-After then succeeds (search)", async () => {
    fetchMock
      .mockResolvedValueOnce(
        new Response("rate limited", { status: 429, headers: { "retry-after": "1" } }),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ resourceType: "Bundle", type: "searchset", entry: [] }), {
          status: 200,
        }),
      );
    const client = new FhirClient("https://fhir.example.com/r4", tokenProvider, { sleep: noSleep });
    const result = await client.search("Patient", { name: "x" });
    expect(result).toEqual([]);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("does NOT retry 403 (read)", async () => {
    fetchMock.mockResolvedValue(new Response("forbidden", { status: 403 }));
    const client = new FhirClient("https://fhir.example.com/r4", tokenProvider, { sleep: noSleep });
    await expect(client.read("Patient", "p1")).rejects.toThrow(/FHIR request failed: 403/);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("everything() returns the union of the $everything Bundle entries", async () => {
    fetchMock.mockResolvedValue(
      new Response(
        JSON.stringify({
          resourceType: "Bundle",
          type: "searchset",
          entry: [
            { resource: { resourceType: "Condition", id: "c1" } },
            { resource: { resourceType: "MedicationRequest", id: "m1" } },
            { resource: { resourceType: "Observation", id: "o1" } },
          ],
        }),
        { status: 200 },
      ),
    );
    const client = new FhirClient("https://fhir.example.com/r4", tokenProvider, { sleep: noSleep });
    const r = await client.everything("p1");
    expect(r.map((x) => x.resourceType)).toEqual(["Condition", "MedicationRequest", "Observation"]);
    expect(fetchMock.mock.calls[0][0]).toBe("https://fhir.example.com/r4/Patient/p1/$everything");
  });

  it("everything() passes _type and _since through as query params", async () => {
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify({ resourceType: "Bundle", type: "searchset" }), { status: 200 }),
    );
    const client = new FhirClient("https://fhir.example.com/r4", tokenProvider, { sleep: noSleep });
    await client.everything("p1", {
      types: ["Condition", "MedicationRequest"],
      since: "2026-01-01",
    });
    const url = fetchMock.mock.calls[0][0] as string;
    expect(url).toContain("/Patient/p1/$everything");
    expect(url).toContain("_type=Condition%2CMedicationRequest");
    expect(url).toContain("_since=2026-01-01");
  });

  it("everything() falls back to per-type search when $everything returns 404", async () => {
    fetchMock.mockResolvedValueOnce(new Response("not found", { status: 404 })).mockImplementation(
      async () =>
        new Response(
          JSON.stringify({
            resourceType: "Bundle",
            type: "searchset",
            entry: [{ resource: { resourceType: "Condition", id: "c1" } }],
          }),
          { status: 200 },
        ),
    );
    const client = new FhirClient("https://fhir.example.com/r4", tokenProvider, { sleep: noSleep });
    const r = await client.everything("p1", { limit: 50, types: ["Condition"] });
    // Caller asked for a single type, so the fallback only does one per-type search.
    expect(r.map((x) => x.resourceType)).toEqual(["Condition"]);
    // First call was $everything (404), second was the per-type Condition search.
    expect(fetchMock.mock.calls[0][0]).toContain("/$everything");
    expect(fetchMock.mock.calls[1][0]).toContain("/Condition?");
  });

  it("everything() falls back on 422 too", async () => {
    fetchMock
      .mockResolvedValueOnce(new Response("unprocessable", { status: 422 }))
      .mockImplementation(
        async () =>
          new Response(JSON.stringify({ resourceType: "Bundle", type: "searchset" }), {
            status: 200,
          }),
      );
    const client = new FhirClient("https://fhir.example.com/r4", tokenProvider, { sleep: noSleep });
    // Scope to a single type so the fallback only does one extra fetch.
    const r = await client.everything("p1", { types: ["Condition"] });
    expect(r).toEqual([]);
    expect(fetchMock.mock.calls[0][0]).toContain("/$everything");
    expect(fetchMock.mock.calls).toHaveLength(2);
  });

  it("everything() does NOT fall back on 500 (real error propagates)", async () => {
    fetchMock.mockResolvedValue(new Response("server error", { status: 500 }));
    const client = new FhirClient("https://fhir.example.com/r4", tokenProvider, { sleep: noSleep });
    await expect(client.everything("p1")).rejects.toThrow(/FHIR request failed: 500/);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("everything() caps the result at the requested limit", async () => {
    fetchMock.mockResolvedValue(
      new Response(
        JSON.stringify({
          resourceType: "Bundle",
          type: "searchset",
          entry: [
            { resource: { resourceType: "Observation", id: "o1" } },
            { resource: { resourceType: "Observation", id: "o2" } },
            { resource: { resourceType: "Observation", id: "o3" } },
          ],
        }),
        { status: 200 },
      ),
    );
    const client = new FhirClient("https://fhir.example.com/r4", tokenProvider, { sleep: noSleep });
    const r = await client.everything("p1", { limit: 2 });
    expect(r).toHaveLength(2);
  });
});
