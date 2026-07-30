import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { ToolDeps } from "./patients.js";
import { shapeEncounter, shapeDocumentReference } from "../fhir/shapers.js";
import { paged, errorResult, listOutputSchema, limitParam, READ_ONLY } from "./result.js";

const encounterShape = {
  id: z.string().optional().describe("FHIR Encounter resource id"),
  status: z.string().optional().describe("Encounter status, e.g. finished, in-progress, cancelled"),
  class: z.string().optional().describe("Encounter class, e.g. ambulatory, inpatient"),
  start: z.string().optional().describe("Encounter start time (ISO 8601)"),
  type: z.string().optional().describe("Encounter type description"),
};

const documentShape = {
  id: z.string().optional().describe("FHIR DocumentReference resource id"),
  type: z.string().optional().describe("Document type, e.g. Progress note, Discharge summary"),
  date: z.string().optional().describe("Document date (ISO 8601)"),
  status: z.string().optional().describe("Document status, e.g. current, superseded"),
  description: z.string().optional().describe("Human-readable description of the document"),
};

export function registerRecordTools(server: McpServer, { client, audit }: ToolDeps): number {
  const patientId = z
    .string()
    .describe("FHIR Patient resource id (from practicefusion_search_patients)");

  server.registerTool(
    "practicefusion_get_encounters",
    {
      title: "Get encounters",
      description:
        "List a patient's clinical encounters (visits) from Practice Fusion. Returns shaped encounter summaries (status, class, start, type). Read-only.",
      inputSchema: { patientId, limit: limitParam },
      outputSchema: listOutputSchema(encounterShape),
      annotations: READ_ONLY,
    },
    async (args) => {
      const limit = typeof args.limit === "number" ? args.limit : 50;
      const params = { patient: args.patientId };
      try {
        const r = await client.search("Encounter", params, { limit });
        audit.record({ tool: "practicefusion_get_encounters", params, outcome: "ok" });
        return paged(r.map(shapeEncounter), limit);
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        audit.record({
          tool: "practicefusion_get_encounters",
          params,
          outcome: "error",
          error: msg,
        });
        return errorResult(msg, "Verify patientId is a valid FHIR Patient id.");
      }
    },
  );

  server.registerTool(
    "practicefusion_get_documents",
    {
      title: "Get document references",
      description:
        "List a patient's document references (clinical notes, summaries, attachments metadata) from Practice Fusion. Returns shaped document summaries; does not download binary content. Read-only.",
      inputSchema: { patientId, limit: limitParam },
      outputSchema: listOutputSchema(documentShape),
      annotations: READ_ONLY,
    },
    async (args) => {
      const limit = typeof args.limit === "number" ? args.limit : 50;
      const params = { patient: args.patientId };
      try {
        const r = await client.search("DocumentReference", params, { limit });
        audit.record({ tool: "practicefusion_get_documents", params, outcome: "ok" });
        return paged(r.map(shapeDocumentReference), limit);
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        audit.record({
          tool: "practicefusion_get_documents",
          params,
          outcome: "error",
          error: msg,
        });
        return errorResult(msg, "Verify patientId is a valid FHIR Patient id.");
      }
    },
  );

  return 2;
}
