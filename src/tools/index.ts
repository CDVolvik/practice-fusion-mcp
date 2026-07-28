import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { registerPatientTools, type ToolDeps } from "./patients.js";
import { registerAppointmentTools } from "./appointments.js";
import { registerClinicalTools } from "./clinical.js";
import { registerRecordTools } from "./records.js";
import { registerDirectoryTools } from "./directory.js";
import { registerCoverageTools } from "./coverage.js";
import { registerEverythingTool } from "./everything.js";

export function registerAllTools(server: McpServer, deps: ToolDeps): void {
  registerPatientTools(server, deps);
  registerAppointmentTools(server, deps);
  registerClinicalTools(server, deps);
  registerRecordTools(server, deps);
  registerDirectoryTools(server, deps);
  registerCoverageTools(server, deps);
  registerEverythingTool(server, deps);
}
