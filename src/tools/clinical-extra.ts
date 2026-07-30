import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { ToolDeps } from "./patients.js";
import {
  shapeProcedure,
  shapeDiagnosticReport,
  shapeCarePlan,
  shapeGoal,
} from "../fhir/shapers.js";
import { paged, errorResult, listOutputSchema, limitParam, READ_ONLY } from "./result.js";

const procedureShape = {
  id: z.string().optional().describe("FHIR Procedure resource id"),
  procedure: z.string().optional().describe("Procedure name"),
  status: z.string().optional().describe("Status, e.g. completed, in-progress"),
  date: z.string().optional().describe("When the procedure was performed"),
};

const diagnosticReportShape = {
  id: z.string().optional().describe("FHIR DiagnosticReport resource id"),
  report: z.string().optional().describe("Report name, e.g. Lipid panel, Chest X-ray"),
  status: z.string().optional().describe("Status, e.g. final, preliminary"),
  date: z.string().optional().describe("Effective date/time of the report"),
  conclusion: z.string().optional().describe("Narrative conclusion, if present"),
};

const carePlanShape = {
  id: z.string().optional().describe("FHIR CarePlan resource id"),
  title: z.string().optional().describe("Care plan title or category"),
  status: z.string().optional().describe("Status, e.g. active, completed"),
  start: z.string().optional().describe("Care plan start date"),
};

const goalShape = {
  id: z.string().optional().describe("FHIR Goal resource id"),
  goal: z.string().optional().describe("Goal description"),
  status: z.string().optional().describe("Lifecycle status, e.g. active, achieved"),
  dueDate: z.string().optional().describe("Target due date, if set"),
};

/**
 * Additional US Core clinical read tools that broaden coverage beyond the core
 * set in `clinical.ts`: procedures, diagnostic reports, care plans, and goals.
 * Same shape as the other list tools — filter by `patientId`, page with
 * `limit`, audit every call. Returns the number of tools registered.
 */
export function registerClinicalExtraTools(server: McpServer, { client, audit }: ToolDeps): number {
  const patientId = z
    .string()
    .describe("FHIR Patient resource id (from practicefusion_search_patients)");

  server.registerTool(
    "practicefusion_get_procedures",
    {
      title: "Get procedures",
      description:
        "List a patient's procedures from Practice Fusion. Returns shaped procedure summaries (name, status, date). Read-only.",
      inputSchema: { patientId, limit: limitParam },
      outputSchema: listOutputSchema(procedureShape),
      annotations: READ_ONLY,
    },
    async (args) => {
      const limit = typeof args.limit === "number" ? args.limit : 50;
      const params = { patient: args.patientId };
      try {
        const r = await client.search("Procedure", params, { limit });
        audit.record({ tool: "practicefusion_get_procedures", params, outcome: "ok" });
        return paged(r.map(shapeProcedure), limit);
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        audit.record({
          tool: "practicefusion_get_procedures",
          params,
          outcome: "error",
          error: msg,
        });
        return errorResult(msg, "Verify patientId is a valid FHIR Patient id.");
      }
    },
  );

  server.registerTool(
    "practicefusion_get_diagnostic_reports",
    {
      title: "Get diagnostic reports",
      description:
        "List a patient's diagnostic reports (lab and imaging report summaries, distinct from individual observations) from Practice Fusion. Returns shaped report summaries. Read-only.",
      inputSchema: { patientId, limit: limitParam },
      outputSchema: listOutputSchema(diagnosticReportShape),
      annotations: READ_ONLY,
    },
    async (args) => {
      const limit = typeof args.limit === "number" ? args.limit : 50;
      const params = { patient: args.patientId };
      try {
        const r = await client.search("DiagnosticReport", params, { limit });
        audit.record({ tool: "practicefusion_get_diagnostic_reports", params, outcome: "ok" });
        return paged(r.map(shapeDiagnosticReport), limit);
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        audit.record({
          tool: "practicefusion_get_diagnostic_reports",
          params,
          outcome: "error",
          error: msg,
        });
        return errorResult(msg, "Verify patientId is a valid FHIR Patient id.");
      }
    },
  );

  server.registerTool(
    "practicefusion_get_care_plans",
    {
      title: "Get care plans",
      description:
        "List a patient's care plans from Practice Fusion. Returns shaped care-plan summaries (title, status, start). Read-only.",
      inputSchema: { patientId, limit: limitParam },
      outputSchema: listOutputSchema(carePlanShape),
      annotations: READ_ONLY,
    },
    async (args) => {
      const limit = typeof args.limit === "number" ? args.limit : 50;
      const params = { patient: args.patientId };
      try {
        const r = await client.search("CarePlan", params, { limit });
        audit.record({ tool: "practicefusion_get_care_plans", params, outcome: "ok" });
        return paged(r.map(shapeCarePlan), limit);
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        audit.record({
          tool: "practicefusion_get_care_plans",
          params,
          outcome: "error",
          error: msg,
        });
        return errorResult(msg, "Verify patientId is a valid FHIR Patient id.");
      }
    },
  );

  server.registerTool(
    "practicefusion_get_goals",
    {
      title: "Get goals",
      description:
        "List a patient's care goals from Practice Fusion. Returns shaped goal summaries (description, status, due date). Read-only.",
      inputSchema: { patientId, limit: limitParam },
      outputSchema: listOutputSchema(goalShape),
      annotations: READ_ONLY,
    },
    async (args) => {
      const limit = typeof args.limit === "number" ? args.limit : 50;
      const params = { patient: args.patientId };
      try {
        const r = await client.search("Goal", params, { limit });
        audit.record({ tool: "practicefusion_get_goals", params, outcome: "ok" });
        return paged(r.map(shapeGoal), limit);
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        audit.record({ tool: "practicefusion_get_goals", params, outcome: "error", error: msg });
        return errorResult(msg, "Verify patientId is a valid FHIR Patient id.");
      }
    },
  );

  return 4;
}
