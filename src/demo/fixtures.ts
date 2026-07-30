import type { FhirResource } from "../fhir/client.js";

/**
 * Synthetic FHIR R4 resources for `--demo` mode. Everything here is invented —
 * no real patient data. The first patient (`abc123`, Ana Rivera) is seeded to
 * match the query shown in the README's Example section, so the documented
 * walkthrough runs verbatim against these fixtures.
 *
 * Structure mirrors what Practice Fusion's Open FHIR returns closely enough for
 * the shapers in `fhir/shapers.ts`: names as `name[0].given/family`, statuses
 * under `clinicalStatus.coding[0].code`, observation values as `valueQuantity`,
 * and each clinical resource carrying a `subject` / `patient` / `beneficiary`
 * reference back to its patient.
 */
export const demoResources: FhirResource[] = [
  // ---- Patients & providers -------------------------------------------------
  {
    resourceType: "Patient",
    id: "abc123",
    name: [{ given: ["Ana"], family: "Rivera" }],
    gender: "female",
    birthDate: "1984-02-11",
    telecom: [{ system: "phone", value: "555-0142" }],
    identifier: [{ system: "urn:pf:mrn", value: "MRN-10042" }],
  },
  {
    resourceType: "Patient",
    id: "def456",
    name: [{ given: ["Marcus"], family: "Webb" }],
    gender: "male",
    birthDate: "1971-09-30",
    telecom: [{ system: "phone", value: "555-0198" }],
    identifier: [{ system: "urn:pf:mrn", value: "MRN-10078" }],
  },
  {
    resourceType: "Practitioner",
    id: "prac-1",
    name: [{ given: ["Elena"], family: "Sato" }],
    telecom: [{ system: "phone", value: "555-0110" }],
    qualification: [{ code: { text: "MD, Internal Medicine" } }],
  },

  // ---- Ana Rivera (abc123) — clinical --------------------------------------
  {
    resourceType: "MedicationRequest",
    id: "med-1",
    status: "active",
    subject: { reference: "Patient/abc123", display: "Ana Rivera" },
    medicationCodeableConcept: { text: "Lisinopril 10 mg" },
  },
  {
    resourceType: "MedicationRequest",
    id: "med-2",
    status: "active",
    subject: { reference: "Patient/abc123", display: "Ana Rivera" },
    medicationCodeableConcept: { text: "Atorvastatin 20 mg" },
  },
  {
    resourceType: "Condition",
    id: "cond-1",
    subject: { reference: "Patient/abc123" },
    code: { text: "Essential hypertension" },
    clinicalStatus: { coding: [{ code: "active" }] },
  },
  {
    resourceType: "Condition",
    id: "cond-2",
    subject: { reference: "Patient/abc123" },
    code: { text: "Hyperlipidemia" },
    clinicalStatus: { coding: [{ code: "active" }] },
  },
  {
    resourceType: "Observation",
    id: "lab-1",
    subject: { reference: "Patient/abc123" },
    category: [{ coding: [{ code: "laboratory" }] }],
    code: { text: "LDL cholesterol" },
    valueQuantity: { value: 128, unit: "mg/dL" },
    effectiveDateTime: "2026-05-14",
  },
  {
    resourceType: "Observation",
    id: "lab-2",
    subject: { reference: "Patient/abc123" },
    category: [{ coding: [{ code: "laboratory" }] }],
    code: { text: "Hemoglobin A1c" },
    valueQuantity: { value: 5.9, unit: "%" },
    effectiveDateTime: "2026-05-14",
  },
  {
    resourceType: "Observation",
    id: "vital-1",
    subject: { reference: "Patient/abc123" },
    category: [{ coding: [{ code: "vital-signs" }] }],
    code: { text: "Blood pressure" },
    valueString: "138/86 mmHg",
    effectiveDateTime: "2026-06-02",
  },
  {
    resourceType: "Observation",
    id: "vital-2",
    subject: { reference: "Patient/abc123" },
    category: [{ coding: [{ code: "vital-signs" }] }],
    code: { text: "Heart rate" },
    valueQuantity: { value: 72, unit: "beats/min" },
    effectiveDateTime: "2026-06-02",
  },
  {
    resourceType: "AllergyIntolerance",
    id: "allergy-1",
    patient: { reference: "Patient/abc123" },
    code: { text: "Penicillin" },
    clinicalStatus: { coding: [{ code: "active" }] },
    criticality: "high",
  },
  {
    resourceType: "Immunization",
    id: "imm-1",
    status: "completed",
    patient: { reference: "Patient/abc123" },
    vaccineCode: { text: "Influenza, seasonal" },
    occurrenceDateTime: "2025-10-08",
  },
  {
    resourceType: "Appointment",
    id: "appt-1",
    status: "booked",
    start: "2026-08-03T15:00:00Z",
    appointmentType: { text: "Follow-up visit" },
    participant: [{ actor: { reference: "Patient/abc123", display: "Ana Rivera" } }],
  },
  {
    resourceType: "Encounter",
    id: "enc-1",
    status: "finished",
    class: { code: "AMB", display: "ambulatory" },
    type: [{ text: "Office visit" }],
    period: { start: "2026-06-02T14:30:00Z" },
    subject: { reference: "Patient/abc123" },
  },
  {
    resourceType: "DocumentReference",
    id: "doc-1",
    status: "current",
    type: { text: "Progress note" },
    date: "2026-06-02T15:10:00Z",
    description: "Routine follow-up, blood pressure review",
    subject: { reference: "Patient/abc123" },
  },
  {
    resourceType: "Coverage",
    id: "cov-1",
    status: "active",
    type: { text: "PPO" },
    subscriberId: "SUB-55501",
    beneficiary: { reference: "Patient/abc123" },
    payer: [{ display: "Blue Shield Demo Plan" }],
    period: { start: "2026-01-01", end: "2026-12-31" },
    relationship: { coding: [{ code: "self", display: "Self" }] },
  },

  // ---- Marcus Webb (def456) — a smaller record for variety -----------------
  {
    resourceType: "Condition",
    id: "cond-3",
    subject: { reference: "Patient/def456" },
    code: { text: "Type 2 diabetes mellitus" },
    clinicalStatus: { coding: [{ code: "active" }] },
  },
  {
    resourceType: "MedicationRequest",
    id: "med-3",
    status: "active",
    subject: { reference: "Patient/def456", display: "Marcus Webb" },
    medicationCodeableConcept: { text: "Metformin 500 mg" },
  },
  {
    resourceType: "Appointment",
    id: "appt-2",
    status: "fulfilled",
    start: "2026-05-20T16:00:00Z",
    appointmentType: { text: "Annual physical" },
    participant: [{ actor: { reference: "Patient/def456", display: "Marcus Webb" } }],
  },
];
