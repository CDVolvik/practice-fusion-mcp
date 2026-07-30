import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

/** A single-message user prompt payload, in the shape the MCP SDK expects. */
function userPrompt(text: string) {
  return { messages: [{ role: "user" as const, content: { type: "text" as const, text } }] };
}

/**
 * Guide an assistant to assemble a concise pre-visit summary for one patient
 * from the read-only tools. Pure so it can be unit-tested without a server.
 */
export function preVisitSummaryPrompt(patientId: string) {
  return userPrompt(
    `Prepare a pre-visit summary for the patient with FHIR id ${patientId}.

Gather, using the read-only Practice Fusion tools:
- active problems — practicefusion_get_conditions
- current medications — practicefusion_get_medications
- allergies — practicefusion_get_allergies
- recent vitals and labs — practicefusion_get_vitals, practicefusion_get_lab_results
- upcoming appointments — practicefusion_get_appointments

Then write a summary a clinician can read in under a minute: active problems, current medications with any allergy conflicts flagged, notable recent results, and the reason for the upcoming visit. Note anything missing rather than guessing.`,
  );
}

/**
 * Guide an assistant through a medication review for one patient. Framed as
 * decision support for a licensed clinician, not a prescribing recommendation.
 */
export function medicationReviewPrompt(patientId: string) {
  return userPrompt(
    `Review the medications for the patient with FHIR id ${patientId}.

Gather current medications (practicefusion_get_medications), active problems (practicefusion_get_conditions), and allergies (practicefusion_get_allergies). Then:
- list each active medication with its status,
- flag any medication that conflicts with a recorded allergy,
- note medications without a clear matching indication among the active problems,
- call out anything that looks duplicated.

This is decision support for a licensed clinician, not a prescribing recommendation. Read-only.`,
  );
}

/** Register the prompt templates and return how many were registered. */
export function registerPrompts(server: McpServer): number {
  server.registerPrompt(
    "pre_visit_summary",
    {
      title: "Pre-visit summary",
      description: "Assemble a concise pre-visit summary for a patient from the read tools.",
      argsSchema: { patientId: z.string().describe("FHIR Patient resource id") },
    },
    ({ patientId }) => preVisitSummaryPrompt(patientId),
  );

  server.registerPrompt(
    "medication_review",
    {
      title: "Medication review",
      description: "Review a patient's medications against their problems and allergies.",
      argsSchema: { patientId: z.string().describe("FHIR Patient resource id") },
    },
    ({ patientId }) => medicationReviewPrompt(patientId),
  );

  return 2;
}
