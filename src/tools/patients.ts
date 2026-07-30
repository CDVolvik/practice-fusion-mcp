import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { FhirReader } from "../fhir/client.js";
import type { AuditLogger } from "../audit/logger.js";
import { shapePatient } from "../fhir/shapers.js";
import { paged, errorResult, listOutputSchema, limitParam, READ_ONLY } from "./result.js";

export interface ToolDeps {
  client: FhirReader;
  audit: AuditLogger;
}

const patientShape = {
  id: z.string().optional().describe("FHIR Patient resource id"),
  name: z.string().describe("Patient full name"),
  birthDate: z.string().optional().describe("Date of birth, YYYY-MM-DD"),
  gender: z.string().optional().describe("Administrative gender"),
  phone: z.string().optional().describe("Primary phone number, if present"),
};

export function registerPatientTools(server: McpServer, { client, audit }: ToolDeps): number {
  server.registerTool(
    "practicefusion_search_patients",
    {
      title: "Search patients",
      description:
        "Search Practice Fusion patients by demographics. Combine any of name, birthdate, gender, or identifier to narrow the search; returns shaped patient summaries (id, name, birthDate, gender, phone). Use the returned id with practicefusion_get_patient and the clinical tools. Read-only.",
      inputSchema: {
        name: z.string().optional().describe('Full or partial patient name, e.g. "Ana Rivera"'),
        birthdate: z.string().optional().describe("Date of birth, YYYY-MM-DD"),
        gender: z
          .enum(["male", "female", "other", "unknown"])
          .optional()
          .describe("Administrative gender"),
        identifier: z.string().optional().describe("Patient identifier such as an MRN"),
        limit: limitParam,
      },
      outputSchema: listOutputSchema(patientShape),
      annotations: READ_ONLY,
    },
    async (args) => {
      const { limit: rawLimit, ...rest } = args as Record<string, string | number | undefined>;
      const limit = typeof rawLimit === "number" ? rawLimit : 50;
      const params = Object.fromEntries(
        Object.entries(rest).filter(([, v]) => v !== undefined) as [string, string][],
      );
      try {
        const results = await client.search("Patient", params, { limit });
        audit.record({ tool: "practicefusion_search_patients", params, outcome: "ok" });
        return paged(results.map(shapePatient), limit);
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        audit.record({
          tool: "practicefusion_search_patients",
          params,
          outcome: "error",
          error: msg,
        });
        return errorResult(
          msg,
          "Check the parameters (birthdate must be YYYY-MM-DD) and add filters to narrow the search.",
        );
      }
    },
  );

  server.registerTool(
    "practicefusion_get_patient",
    {
      title: "Get patient",
      description:
        "Get a single Practice Fusion patient's demographics by FHIR Patient id (obtain the id from practicefusion_search_patients). Read-only.",
      inputSchema: { patientId: z.string().describe("FHIR Patient resource id") },
      outputSchema: patientShape,
      annotations: READ_ONLY,
    },
    async ({ patientId }) => {
      try {
        const patient = await client.read("Patient", patientId);
        audit.record({ tool: "practicefusion_get_patient", params: { patientId }, outcome: "ok" });
        const shaped = shapePatient(patient);
        return {
          content: [{ type: "text" as const, text: JSON.stringify(shaped, null, 2) }],
          structuredContent: shaped,
        };
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        audit.record({
          tool: "practicefusion_get_patient",
          params: { patientId },
          outcome: "error",
          error: msg,
        });
        return errorResult(
          msg,
          "Verify patientId is a valid FHIR Patient id returned by practicefusion_search_patients.",
        );
      }
    },
  );

  return 2;
}
