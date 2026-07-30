import { describe, it, expect, vi } from "vitest";
import { registerClinicalExtraTools } from "./clinical-extra.js";
import type { FhirClient } from "../fhir/client.js";
import { AuditLogger } from "../audit/logger.js";

function harness() {
  const handlers = new Map<string, (args: any) => Promise<any>>();
  const server = { registerTool: (n: string, _c: unknown, h: any) => handlers.set(n, h) };
  const client = { search: vi.fn(), read: vi.fn() } as unknown as FhirClient;
  const audit = new AuditLogger();
  vi.spyOn(audit, "record").mockImplementation(() => {});
  const count = registerClinicalExtraTools(server as any, { client, audit });
  return { handlers, client, count };
}

describe("clinical-extra tools", () => {
  it("registers four tools", () => {
    const { count, handlers } = harness();
    expect(count).toBe(4);
    expect(handlers.size).toBe(4);
  });

  it("get_procedures searches Procedure by patient", async () => {
    const { handlers, client } = harness();
    (client.search as any).mockResolvedValue([
      {
        resourceType: "Procedure",
        id: "pr1",
        code: { text: "Colonoscopy" },
        status: "completed",
        performedDateTime: "2025-11-19",
      },
    ]);
    const res = await handlers.get("practicefusion_get_procedures")!({ patientId: "p1" });
    expect(client.search).toHaveBeenCalledWith("Procedure", { patient: "p1" }, { limit: 50 });
    expect(res.structuredContent.results[0].procedure).toBe("Colonoscopy");
    expect(res.structuredContent.results[0].date).toBe("2025-11-19");
  });

  it("get_diagnostic_reports searches DiagnosticReport by patient", async () => {
    const { handlers, client } = harness();
    (client.search as any).mockResolvedValue([
      {
        resourceType: "DiagnosticReport",
        id: "dr1",
        code: { text: "Lipid panel" },
        status: "final",
        conclusion: "LDL elevated.",
      },
    ]);
    const res = await handlers.get("practicefusion_get_diagnostic_reports")!({ patientId: "p1" });
    expect(client.search).toHaveBeenCalledWith(
      "DiagnosticReport",
      { patient: "p1" },
      { limit: 50 },
    );
    expect(res.structuredContent.results[0].report).toBe("Lipid panel");
    expect(res.structuredContent.results[0].conclusion).toBe("LDL elevated.");
  });

  it("get_care_plans searches CarePlan by patient", async () => {
    const { handlers, client } = harness();
    (client.search as any).mockResolvedValue([
      { resourceType: "CarePlan", id: "cp1", title: "Diabetes plan", status: "active" },
    ]);
    const res = await handlers.get("practicefusion_get_care_plans")!({ patientId: "p1" });
    expect(client.search).toHaveBeenCalledWith("CarePlan", { patient: "p1" }, { limit: 50 });
    expect(res.structuredContent.results[0].title).toBe("Diabetes plan");
  });

  it("get_goals searches Goal by patient", async () => {
    const { handlers, client } = harness();
    (client.search as any).mockResolvedValue([
      {
        resourceType: "Goal",
        id: "g1",
        description: { text: "Lower LDL below 100" },
        lifecycleStatus: "active",
      },
    ]);
    const res = await handlers.get("practicefusion_get_goals")!({ patientId: "p1" });
    expect(client.search).toHaveBeenCalledWith("Goal", { patient: "p1" }, { limit: 50 });
    expect(res.structuredContent.results[0].goal).toBe("Lower LDL below 100");
    expect(res.structuredContent.results[0].status).toBe("active");
  });

  it("surfaces errors with a hint", async () => {
    const { handlers, client } = harness();
    (client.search as any).mockRejectedValue(new Error("FHIR request failed: 404"));
    const res = await handlers.get("practicefusion_get_procedures")!({ patientId: "bad" });
    expect(res.isError).toBe(true);
    expect(res.content[0].text).toContain("Verify patientId");
  });
});
