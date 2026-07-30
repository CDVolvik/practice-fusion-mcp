import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { registerPatientTools, type ToolDeps } from "./patients.js";
import { registerAppointmentTools } from "./appointments.js";
import { registerClinicalTools } from "./clinical.js";
import { registerRecordTools } from "./records.js";
import { registerDirectoryTools } from "./directory.js";
import { registerCoverageTools } from "./coverage.js";
import { registerEverythingTool } from "./everything.js";
import { registerClinicalExtraTools } from "./clinical-extra.js";

/**
 * Register every read tool on the server and return how many were registered.
 * Each registrar reports its own count and this sum feeds the startup banner,
 * so the reported tool total stays in step with the tool surface. The
 * `registerAllTools` test asserts this sum equals the registered tool names.
 */
export function registerAllTools(server: McpServer, deps: ToolDeps): number {
  return (
    registerPatientTools(server, deps) +
    registerAppointmentTools(server, deps) +
    registerClinicalTools(server, deps) +
    registerRecordTools(server, deps) +
    registerDirectoryTools(server, deps) +
    registerCoverageTools(server, deps) +
    registerEverythingTool(server, deps) +
    registerClinicalExtraTools(server, deps)
  );
}
