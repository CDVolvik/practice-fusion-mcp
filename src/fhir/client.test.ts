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
});
