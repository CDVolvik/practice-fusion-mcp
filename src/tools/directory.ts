import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { ToolDeps } from "./patients.js";
import { shapePractitioner } from "../fhir/shapers.js";
import { paged, errorResult, listOutputSchema, limitParam, READ_ONLY } from "./result.js";

const practitionerShape = {
  id: z.string().optional().describe("FHIR Practitioner resource id"),
  name: z.string().describe("Practitioner full name"),
  phone: z.string().optional().describe("Contact phone, if present"),
  qualification: z.string().optional().describe("Primary qualification / credential, if present"),
};

export function registerDirectoryTools(server: McpServer, { client, audit }: ToolDeps): number {
  server.registerTool(
    "practicefusion_search_practitioners",
    {
      title: "Search practitioners",
      description:
        "Search Practice Fusion practitioners (providers) by name or identifier. Returns shaped practitioner summaries (name, phone, qualification). Read-only.",
      inputSchema: {
        name: z.string().optional().describe("Full or partial practitioner name"),
        identifier: z.string().optional().describe("Practitioner identifier, e.g. NPI"),
        limit: limitParam,
      },
      outputSchema: listOutputSchema(practitionerShape),
      annotations: READ_ONLY,
    },
    async (args) => {
      const { limit: rawLimit, ...rest } = args as Record<string, string | number | undefined>;
      const limit = typeof rawLimit === "number" ? rawLimit : 50;
      const params = Object.fromEntries(
        Object.entries(rest).filter(([, v]) => v !== undefined) as [string, string][],
      );
      try {
        const r = await client.search("Practitioner", params, { limit });
        audit.record({ tool: "practicefusion_search_practitioners", params, outcome: "ok" });
        return paged(r.map(shapePractitioner), limit);
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        audit.record({
          tool: "practicefusion_search_practitioners",
          params,
          outcome: "error",
          error: msg,
        });
        return errorResult(msg, "Provide a name or identifier to search by.");
      }
    },
  );

  return 1;
}
