import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { ToolDeps } from "./patients.js";
import { errorResult, READ_ONLY } from "./result.js";
import type { FhirResource } from "../fhir/client.js";

const DEFAULT_LIMIT = 200;
const MAX_LIMIT = 1000;

/** Per-type counts + a bounded sample of raw resources. Designed for "tell
 *  me everything about this patient before we start" prompts where the
 *  caller wants a quick lay of the land, not a full chart. */
function shapeEverything(resources: FhirResource[], patientId: string, limit: number) {
  const counts: Record<string, number> = {};
  for (const r of resources) {
    counts[r.resourceType] = (counts[r.resourceType] ?? 0) + 1;
  }
  const totalResources = resources.length;
  const sampled = resources.slice(0, limit);
  return {
    patientId,
    counts,
    totalResources,
    sampledCount: sampled.length,
    truncated: totalResources > sampled.length,
    sampled,
  };
}

const everythingOutputShape = {
  patientId: z.string().describe("FHIR Patient resource id"),
  counts: z
    .record(z.string(), z.number())
    .describe("Resource counts by type, accurate even when the sample is truncated"),
  totalResources: z.number().int().describe("Total resources returned by the server"),
  sampledCount: z.number().int().describe("Number of resources included in `sampled`"),
  truncated: z
    .boolean()
    .describe("True if `sampled` is a subset of the returned set; drill in with the typed tools"),
  sampled: z
    .array(z.record(z.string(), z.unknown()))
    .describe("Up to `limit` raw FHIR resources — call the typed tools for shaped data"),
};

export function registerEverythingTool(server: McpServer, { client, audit }: ToolDeps): number {
  const patientId = z
    .string()
    .describe("FHIR Patient resource id (from practicefusion_search_patients)");

  server.registerTool(
    "practicefusion_get_everything",
    {
      title: "Get patient everything",
      description:
        "Return every resource linked to a single patient (counts per type plus a bounded sample of raw resources). Backed by the FHIR $everything operation when the server supports it, with an automatic fallback to looping the typed tools if the server returns 404/422. Use this for pre-visit summaries; for shaped data on a single resource type, call the typed practicefusion_get_* tool instead. Read-only.",
      inputSchema: {
        patientId,
        types: z
          .array(z.string())
          .optional()
          .describe(
            "Subset of FHIR resource types to include (e.g. ['Condition','MedicationRequest']). Defaults to the full set the server exposes.",
          ),
        since: z
          .string()
          .optional()
          .describe("Only include resources updated after this date (ISO YYYY-MM-DD)"),
        limit: z
          .number()
          .int()
          .min(1)
          .max(MAX_LIMIT)
          .default(DEFAULT_LIMIT)
          .describe(
            "Hard cap on resources returned. Defaults to 200. Use a smaller number to keep the response small; the counts map is always accurate even when the sample is truncated.",
          ),
      },
      outputSchema: everythingOutputShape,
      annotations: READ_ONLY,
    },
    async (args) => {
      const limit = typeof args.limit === "number" ? args.limit : DEFAULT_LIMIT;
      const opts: { types?: string[]; since?: string; limit: number } = { limit };
      if (args.types) opts.types = args.types;
      if (args.since) opts.since = args.since;
      try {
        const resources = await client.everything(args.patientId, opts);
        audit.record({ tool: "practicefusion_get_everything", params: opts, outcome: "ok" });
        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify(shapeEverything(resources, args.patientId, limit), null, 2),
            },
          ],
          structuredContent: shapeEverything(resources, args.patientId, limit),
        };
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        audit.record({
          tool: "practicefusion_get_everything",
          params: opts,
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

  return 1;
}
