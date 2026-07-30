import { describe, it, expect, vi } from "vitest";
import { registerAllTools } from "./index.js";
import type { FhirClient } from "../fhir/client.js";
import { AuditLogger } from "../audit/logger.js";

describe("registerAllTools", () => {
  it("registers all eighteen read tools", () => {
    const names: string[] = [];
    const server = { registerTool: (n: string) => names.push(n) };
    const client = { search: vi.fn(), read: vi.fn(), everything: vi.fn() } as unknown as FhirClient;
    const count = registerAllTools(server as any, { client, audit: new AuditLogger() });
    expect(count).toBe(names.length);
    expect(count).toBe(18);
    expect(names.sort()).toEqual(
      [
        "practicefusion_get_allergies",
        "practicefusion_get_appointments",
        "practicefusion_get_care_plans",
        "practicefusion_get_conditions",
        "practicefusion_get_coverage",
        "practicefusion_get_diagnostic_reports",
        "practicefusion_get_documents",
        "practicefusion_get_encounters",
        "practicefusion_get_everything",
        "practicefusion_get_goals",
        "practicefusion_get_immunizations",
        "practicefusion_get_lab_results",
        "practicefusion_get_medications",
        "practicefusion_get_patient",
        "practicefusion_get_procedures",
        "practicefusion_get_vitals",
        "practicefusion_search_patients",
        "practicefusion_search_practitioners",
      ].sort(),
    );
  });
});
