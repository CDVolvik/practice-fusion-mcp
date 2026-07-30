import { describe, it, expect } from "vitest";
import { summarizePatient, registerResources } from "./patient-summary.js";
import type { FhirResource } from "../fhir/client.js";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { ToolDeps } from "../tools/patients.js";

describe("summarizePatient", () => {
  it("counts resources by type", () => {
    const resources: FhirResource[] = [
      { resourceType: "Condition", id: "c1" },
      { resourceType: "Condition", id: "c2" },
      { resourceType: "MedicationRequest", id: "m1" },
    ];
    const s = summarizePatient("abc123", resources);
    expect(s.patientId).toBe("abc123");
    expect(s.resourceCount).toBe(3);
    expect(s.counts).toEqual({ Condition: 2, MedicationRequest: 1 });
    expect(s.resources).toHaveLength(3);
  });

  it("handles an empty record", () => {
    const s = summarizePatient("nobody", []);
    expect(s.resourceCount).toBe(0);
    expect(s.counts).toEqual({});
  });
});

describe("registerResources", () => {
  it("registers the patient-summary resource template", () => {
    const names: string[] = [];
    const server = { registerResource: (n: string) => names.push(n) } as unknown as McpServer;
    const count = registerResources(server, {} as ToolDeps);
    expect(count).toBe(1);
    expect(names).toEqual(["patient-summary"]);
  });
});
