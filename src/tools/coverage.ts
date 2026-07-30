import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { ToolDeps } from "./patients.js";
import { shapeCoverage } from "../fhir/shapers.js";
import { paged, errorResult, listOutputSchema, limitParam, READ_ONLY } from "./result.js";

const coverageShape = {
  id: z.string().optional().describe("FHIR Coverage resource id"),
  status: z
    .string()
    .optional()
    .describe("Coverage status, e.g. active, cancelled, draft, entered-in-error"),
  type: z.string().optional().describe("Coverage type, e.g. medical, dental, vision"),
  payer: z.string().optional().describe("Insurance payer / carrier name"),
  subscriberId: z
    .string()
    .optional()
    .describe("Subscriber id (the policy/member number) — redact in display contexts"),
  periodStart: z.string().optional().describe("Coverage period start date, YYYY-MM-DD"),
  periodEnd: z.string().optional().describe("Coverage period end date, YYYY-MM-DD"),
  relationship: z
    .string()
    .optional()
    .describe("Subscriber relationship to the insured, e.g. self, spouse, child"),
};

export function registerCoverageTools(server: McpServer, { client, audit }: ToolDeps): number {
  const patientId = z
    .string()
    .describe("FHIR Patient resource id (from practicefusion_search_patients)");

  server.registerTool(
    "practicefusion_get_coverage",
    {
      title: "Get coverage",
      description:
        "List a patient's insurance Coverage records from Practice Fusion. Returns shaped coverage summaries (status, type, payer, subscriber id, period, relationship). Read-only.",
      inputSchema: {
        patientId,
        status: z
          .enum(["active", "cancelled", "draft", "entered-in-error"])
          .optional()
          .describe("Filter to a specific coverage status (defaults to all)"),
        limit: limitParam,
      },
      outputSchema: listOutputSchema(coverageShape),
      annotations: READ_ONLY,
    },
    async (args) => {
      const limit = typeof args.limit === "number" ? args.limit : 50;
      const params: Record<string, string> = { patient: args.patientId };
      if (args.status) params.status = args.status;
      try {
        const r = await client.search("Coverage", params, { limit });
        audit.record({ tool: "practicefusion_get_coverage", params, outcome: "ok" });
        return paged(r.map(shapeCoverage), limit);
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        audit.record({
          tool: "practicefusion_get_coverage",
          params,
          outcome: "error",
          error: msg,
        });
        return errorResult(msg, "Verify patientId is a valid FHIR Patient id.");
      }
    },
  );

  return 1;
}
