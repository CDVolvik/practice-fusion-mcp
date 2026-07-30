import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { ToolDeps } from "./patients.js";
import { shapeAppointment } from "../fhir/shapers.js";
import { paged, errorResult, listOutputSchema, limitParam, READ_ONLY } from "./result.js";

const appointmentShape = {
  id: z.string().optional().describe("FHIR Appointment resource id"),
  status: z.string().optional().describe("e.g. booked, arrived, fulfilled, noshow, cancelled"),
  start: z.string().optional().describe("Appointment start time (ISO 8601)"),
  type: z.string().optional().describe("Appointment type description"),
  patient: z.string().optional().describe("Patient display name for the appointment"),
};

export function registerAppointmentTools(server: McpServer, { client, audit }: ToolDeps): number {
  server.registerTool(
    "practicefusion_get_appointments",
    {
      title: "Get appointments",
      description:
        "List Practice Fusion appointments, optionally filtered by patient, status, and date. Dates use FHIR prefixes, e.g. ge2026-07-01 (on/after) or le2026-07-31 (on/before). Returns shaped appointment summaries. Read-only.",
      inputSchema: {
        patientId: z.string().optional().describe("FHIR Patient resource id"),
        status: z
          .string()
          .optional()
          .describe("Appointment status, e.g. booked, arrived, fulfilled, noshow, cancelled"),
        date: z.string().optional().describe("FHIR date filter, e.g. ge2026-07-01 or le2026-07-31"),
        limit: limitParam,
      },
      outputSchema: listOutputSchema(appointmentShape),
      annotations: READ_ONLY,
    },
    async (args) => {
      const limit = typeof args.limit === "number" ? args.limit : 50;
      const params: Record<string, string> = {};
      if (args.patientId) params.patient = args.patientId;
      if (args.status) params.status = args.status;
      if (args.date) params.date = args.date;
      try {
        const results = await client.search("Appointment", params, { limit });
        audit.record({ tool: "practicefusion_get_appointments", params, outcome: "ok" });
        return paged(results.map(shapeAppointment), limit);
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        audit.record({
          tool: "practicefusion_get_appointments",
          params,
          outcome: "error",
          error: msg,
        });
        return errorResult(
          msg,
          "Check the date filter format (FHIR prefix + YYYY-MM-DD) and that patientId is valid.",
        );
      }
    },
  );

  return 1;
}
