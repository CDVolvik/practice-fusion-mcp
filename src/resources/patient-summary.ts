import { ResourceTemplate, type McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { FhirResource } from "../fhir/client.js";
import type { ToolDeps } from "../tools/patients.js";

/** Group a patient's resources into a compact summary payload. Pure. */
export function summarizePatient(patientId: string, resources: FhirResource[]) {
  const counts: Record<string, number> = {};
  for (const r of resources) counts[r.resourceType] = (counts[r.resourceType] ?? 0) + 1;
  return { patientId, resourceCount: resources.length, counts, resources };
}

/**
 * Expose a patient's full record as a readable MCP resource at
 * `practicefusion://patient/{patientId}/summary` — the resource-shaped
 * counterpart to the `practicefusion_get_everything` tool. Reads are audited
 * like every other access. Returns the number of resources registered.
 */
export function registerResources(server: McpServer, { client, audit }: ToolDeps): number {
  server.registerResource(
    "patient-summary",
    new ResourceTemplate("practicefusion://patient/{patientId}/summary", { list: undefined }),
    {
      title: "Patient summary",
      description: "Every resource linked to a patient (FHIR $everything), as JSON — read-only.",
      mimeType: "application/json",
    },
    async (uri, variables) => {
      const raw = variables.patientId;
      const patientId = Array.isArray(raw) ? raw[0] : raw;
      const params = { patientId };
      try {
        const resources = await client.everything(patientId);
        audit.record({ tool: "resource:patient-summary", params, outcome: "ok" });
        const summary = summarizePatient(patientId, resources);
        return {
          contents: [
            {
              uri: uri.href,
              mimeType: "application/json",
              text: JSON.stringify(summary, null, 2),
            },
          ],
        };
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        audit.record({ tool: "resource:patient-summary", params, outcome: "error", error: msg });
        throw e;
      }
    },
  );

  return 1;
}
