import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { ToolDeps } from "./patients.js";
import {
  shapeCondition,
  shapeMedication,
  shapeObservation,
  shapeAllergy,
  shapeImmunization,
} from "../fhir/shapers.js";
import { paged, errorResult, listOutputSchema, limitParam, READ_ONLY } from "./result.js";

const conditionShape = {
  id: z.string().optional().describe("FHIR Condition resource id"),
  condition: z.string().optional().describe("Problem / diagnosis text"),
  status: z.string().optional().describe("Clinical status, e.g. active, resolved"),
};

const medicationShape = {
  id: z.string().optional().describe("FHIR MedicationRequest resource id"),
  medication: z.string().optional().describe("Medication name"),
  status: z.string().optional().describe("Request status, e.g. active, stopped, completed"),
};

const observationShape = {
  id: z.string().optional().describe("FHIR Observation resource id"),
  test: z.string().optional().describe("Test / observation name"),
  value: z.string().optional().describe("Result value with unit, when available"),
  date: z.string().optional().describe("Effective date/time of the observation"),
};

const allergyShape = {
  id: z.string().optional().describe("FHIR AllergyIntolerance resource id"),
  substance: z.string().optional().describe("Allergen / substance"),
  status: z.string().optional().describe("Clinical status, e.g. active, resolved"),
  criticality: z.string().optional().describe("Criticality, e.g. low, high, unable-to-assess"),
};

const immunizationShape = {
  id: z.string().optional().describe("FHIR Immunization resource id"),
  vaccine: z.string().optional().describe("Vaccine name"),
  status: z.string().optional().describe("Status, e.g. completed, not-done"),
  date: z.string().optional().describe("Date administered"),
};

export function registerClinicalTools(server: McpServer, { client, audit }: ToolDeps): number {
  const patientId = z
    .string()
    .describe("FHIR Patient resource id (from practicefusion_search_patients)");

  server.registerTool(
    "practicefusion_get_conditions",
    {
      title: "Get conditions",
      description:
        "List a patient's conditions / problems (diagnoses) from Practice Fusion. Returns shaped condition summaries. Read-only.",
      inputSchema: { patientId, limit: limitParam },
      outputSchema: listOutputSchema(conditionShape),
      annotations: READ_ONLY,
    },
    async (args) => {
      const limit = typeof args.limit === "number" ? args.limit : 50;
      const params = { patient: args.patientId };
      try {
        const r = await client.search("Condition", params, { limit });
        audit.record({ tool: "practicefusion_get_conditions", params, outcome: "ok" });
        return paged(r.map(shapeCondition), limit);
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        audit.record({
          tool: "practicefusion_get_conditions",
          params,
          outcome: "error",
          error: msg,
        });
        return errorResult(msg, "Verify patientId is a valid FHIR Patient id.");
      }
    },
  );

  server.registerTool(
    "practicefusion_get_medications",
    {
      title: "Get medications",
      description:
        "List a patient's medication requests from Practice Fusion. Returns shaped medication summaries. Read-only.",
      inputSchema: { patientId, limit: limitParam },
      outputSchema: listOutputSchema(medicationShape),
      annotations: READ_ONLY,
    },
    async (args) => {
      const limit = typeof args.limit === "number" ? args.limit : 50;
      const params = { patient: args.patientId };
      try {
        const r = await client.search("MedicationRequest", params, { limit });
        audit.record({ tool: "practicefusion_get_medications", params, outcome: "ok" });
        return paged(r.map(shapeMedication), limit);
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        audit.record({
          tool: "practicefusion_get_medications",
          params,
          outcome: "error",
          error: msg,
        });
        return errorResult(msg, "Verify patientId is a valid FHIR Patient id.");
      }
    },
  );

  server.registerTool(
    "practicefusion_get_lab_results",
    {
      title: "Get lab results",
      description:
        "List a patient's laboratory observations (lab results) from Practice Fusion. Returns shaped observation summaries with values and dates. Read-only.",
      inputSchema: { patientId, limit: limitParam },
      outputSchema: listOutputSchema(observationShape),
      annotations: READ_ONLY,
    },
    async (args) => {
      const limit = typeof args.limit === "number" ? args.limit : 50;
      const params = { patient: args.patientId, category: "laboratory" };
      try {
        const r = await client.search("Observation", params, { limit });
        audit.record({ tool: "practicefusion_get_lab_results", params, outcome: "ok" });
        return paged(r.map(shapeObservation), limit);
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        audit.record({
          tool: "practicefusion_get_lab_results",
          params,
          outcome: "error",
          error: msg,
        });
        return errorResult(msg, "Verify patientId is a valid FHIR Patient id.");
      }
    },
  );

  server.registerTool(
    "practicefusion_get_vitals",
    {
      title: "Get vital signs",
      description:
        "List a patient's vital-sign observations (blood pressure, heart rate, temperature, etc.) from Practice Fusion. Returns shaped observation summaries with values and dates. Read-only.",
      inputSchema: { patientId, limit: limitParam },
      outputSchema: listOutputSchema(observationShape),
      annotations: READ_ONLY,
    },
    async (args) => {
      const limit = typeof args.limit === "number" ? args.limit : 50;
      const params = { patient: args.patientId, category: "vital-signs" };
      try {
        const r = await client.search("Observation", params, { limit });
        audit.record({ tool: "practicefusion_get_vitals", params, outcome: "ok" });
        return paged(r.map(shapeObservation), limit);
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        audit.record({ tool: "practicefusion_get_vitals", params, outcome: "error", error: msg });
        return errorResult(msg, "Verify patientId is a valid FHIR Patient id.");
      }
    },
  );

  server.registerTool(
    "practicefusion_get_allergies",
    {
      title: "Get allergies",
      description:
        "List a patient's allergies and intolerances from Practice Fusion. Returns shaped allergy summaries (substance, status, criticality). Read-only.",
      inputSchema: { patientId, limit: limitParam },
      outputSchema: listOutputSchema(allergyShape),
      annotations: READ_ONLY,
    },
    async (args) => {
      const limit = typeof args.limit === "number" ? args.limit : 50;
      const params = { patient: args.patientId };
      try {
        const r = await client.search("AllergyIntolerance", params, { limit });
        audit.record({ tool: "practicefusion_get_allergies", params, outcome: "ok" });
        return paged(r.map(shapeAllergy), limit);
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        audit.record({
          tool: "practicefusion_get_allergies",
          params,
          outcome: "error",
          error: msg,
        });
        return errorResult(msg, "Verify patientId is a valid FHIR Patient id.");
      }
    },
  );

  server.registerTool(
    "practicefusion_get_immunizations",
    {
      title: "Get immunizations",
      description:
        "List a patient's immunizations (vaccines) from Practice Fusion. Returns shaped immunization summaries (vaccine, status, date). Read-only.",
      inputSchema: { patientId, limit: limitParam },
      outputSchema: listOutputSchema(immunizationShape),
      annotations: READ_ONLY,
    },
    async (args) => {
      const limit = typeof args.limit === "number" ? args.limit : 50;
      const params = { patient: args.patientId };
      try {
        const r = await client.search("Immunization", params, { limit });
        audit.record({ tool: "practicefusion_get_immunizations", params, outcome: "ok" });
        return paged(r.map(shapeImmunization), limit);
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        audit.record({
          tool: "practicefusion_get_immunizations",
          params,
          outcome: "error",
          error: msg,
        });
        return errorResult(msg, "Verify patientId is a valid FHIR Patient id.");
      }
    },
  );

  return 6;
}
