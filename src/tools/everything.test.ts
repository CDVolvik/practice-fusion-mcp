import { describe, it, expect, vi } from "vitest";
import { registerEverythingTool } from "./everything.js";
import type { FhirClient } from "../fhir/client.js";
import { AuditLogger } from "../audit/logger.js";

function harness() {
  const handlers = new Map<string, (args: any) => Promise<any>>();
  const server = { registerTool: (n: string, _c: unknown, h: any) => handlers.set(n, h) };
  const client = { everything: vi.fn() } as unknown as FhirClient;
  const audit = new AuditLogger();
  vi.spyOn(audit, "record").mockImplementation(() => {});
  registerEverythingTool(server as any, { client, audit });
  return { handlers, client };
}

describe("everything tool", () => {
  it("calls client.everything and returns counts + sample", async () => {
    const { handlers, client } = harness();
    (client.everything as any).mockResolvedValue([
      { resourceType: "Condition", id: "c1" },
      { resourceType: "Condition", id: "c2" },
      { resourceType: "MedicationRequest", id: "m1" },
    ]);
    const res = await handlers.get("practicefusion_get_everything")!({ patientId: "p1" });
    expect(client.everything).toHaveBeenCalledWith("p1", { limit: 200 });
    const sc = res.structuredContent;
    expect(sc.patientId).toBe("p1");
    expect(sc.counts).toEqual({ Condition: 2, MedicationRequest: 1 });
    expect(sc.totalResources).toBe(3);
    expect(sc.sampledCount).toBe(3);
    expect(sc.truncated).toBe(false);
    expect(sc.sampled).toHaveLength(3);
  });

  it("respects the limit param and marks truncated when it is exceeded", async () => {
    const { handlers, client } = harness();
    const many = Array.from({ length: 5 }, (_, i) => ({
      resourceType: "Observation",
      id: `o${i}`,
    }));
    (client.everything as any).mockResolvedValue(many);
    const res = await handlers.get("practicefusion_get_everything")!({
      patientId: "p1",
      limit: 3,
    });
    expect(client.everything).toHaveBeenCalledWith("p1", { limit: 3 });
    const sc = res.structuredContent;
    expect(sc.sampledCount).toBe(3);
    expect(sc.totalResources).toBe(5);
    expect(sc.truncated).toBe(true);
    expect(sc.counts).toEqual({ Observation: 5 });
    expect(sc.sampled.map((r: { id: string }) => r.id)).toEqual(["o0", "o1", "o2"]);
  });

  it("passes through types and since as client options", async () => {
    const { handlers, client } = harness();
    (client.everything as any).mockResolvedValue([]);
    await handlers.get("practicefusion_get_everything")!({
      patientId: "p1",
      types: ["Condition", "MedicationRequest"],
      since: "2026-01-01",
    });
    expect(client.everything).toHaveBeenCalledWith("p1", {
      limit: 200,
      types: ["Condition", "MedicationRequest"],
      since: "2026-01-01",
    });
  });

  it("returns counts even when the sample is empty", async () => {
    const { handlers, client } = harness();
    (client.everything as any).mockResolvedValue([]);
    const res = await handlers.get("practicefusion_get_everything")!({ patientId: "p1" });
    expect(res.structuredContent.counts).toEqual({});
    expect(res.structuredContent.totalResources).toBe(0);
    expect(res.structuredContent.sampled).toEqual([]);
    expect(res.structuredContent.truncated).toBe(false);
  });

  it("returns an errorResult on a 4xx/5xx from the client", async () => {
    const { handlers, client } = harness();
    (client.everything as any).mockRejectedValue(new Error("FHIR request failed: 500"));
    const res = await handlers.get("practicefusion_get_everything")!({ patientId: "p1" });
    expect(res.isError).toBe(true);
    expect(res.content[0].text).toContain("FHIR request failed: 500");
  });
});
