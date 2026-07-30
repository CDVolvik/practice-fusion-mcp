import type { FhirResource } from "./client.js";

type Any = Record<string, any>;

export type ShapedPatient = {
  id?: string;
  name: string;
  birthDate?: string;
  gender?: string;
  phone?: string;
};

export function shapePatient(r: FhirResource): ShapedPatient {
  const n = (r as Any).name?.[0];
  const name = n ? [n.given?.join(" "), n.family].filter(Boolean).join(" ") : "(unknown)";
  const phone = (r as Any).telecom?.find((t: Any) => t.system === "phone")?.value;
  return { id: r.id, name, birthDate: (r as Any).birthDate, gender: (r as Any).gender, phone };
}

export function shapeAppointment(r: FhirResource) {
  const a = r as Any;
  const patient = a.participant?.find((p: Any) => p.actor?.reference?.startsWith("Patient/"))?.actor
    ?.display;
  return {
    id: r.id,
    status: a.status,
    start: a.start,
    type: a.appointmentType?.text,
    patient,
  };
}

export function shapeCondition(r: FhirResource) {
  const c = r as Any;
  return {
    id: r.id,
    condition: c.code?.text,
    status: c.clinicalStatus?.coding?.[0]?.code,
  };
}

export function shapeMedication(r: FhirResource) {
  const m = r as Any;
  return {
    id: r.id,
    medication: m.medicationCodeableConcept?.text,
    status: m.status,
  };
}

export function shapeObservation(r: FhirResource) {
  const o = r as Any;
  const q = o.valueQuantity;
  return {
    id: r.id,
    test: o.code?.text,
    value: q ? (q.unit ? `${q.value} ${q.unit}` : String(q.value)) : o.valueString,
    date: o.effectiveDateTime,
  };
}

export function shapeAllergy(r: FhirResource) {
  const a = r as Any;
  return {
    id: r.id,
    substance: a.code?.text,
    status: a.clinicalStatus?.coding?.[0]?.code,
    criticality: a.criticality,
  };
}

export function shapeImmunization(r: FhirResource) {
  const i = r as Any;
  return {
    id: r.id,
    vaccine: i.vaccineCode?.text,
    status: i.status,
    date: i.occurrenceDateTime,
  };
}

export function shapeEncounter(r: FhirResource) {
  const e = r as Any;
  return {
    id: r.id,
    status: e.status,
    class: e.class?.display ?? e.class?.code,
    start: e.period?.start,
    type: e.type?.[0]?.text,
  };
}

export function shapePractitioner(r: FhirResource) {
  const n = (r as Any).name?.[0];
  const name = n ? [n.given?.join(" "), n.family].filter(Boolean).join(" ") : "(unknown)";
  const phone = (r as Any).telecom?.find((t: Any) => t.system === "phone")?.value;
  return {
    id: r.id,
    name,
    phone,
    qualification: (r as Any).qualification?.[0]?.code?.text,
  };
}

export function shapeDocumentReference(r: FhirResource) {
  const d = r as Any;
  return {
    id: r.id,
    type: d.type?.text,
    date: d.date,
    status: d.status,
    description: d.description,
  };
}

export function shapeProcedure(r: FhirResource) {
  const p = r as Any;
  return {
    id: r.id,
    procedure: p.code?.text,
    status: p.status,
    date: p.performedDateTime ?? p.performedPeriod?.start,
  };
}

export function shapeDiagnosticReport(r: FhirResource) {
  const d = r as Any;
  return {
    id: r.id,
    report: d.code?.text,
    status: d.status,
    date: d.effectiveDateTime,
    conclusion: d.conclusion,
  };
}

export function shapeCarePlan(r: FhirResource) {
  const c = r as Any;
  return {
    id: r.id,
    title: c.title ?? c.category?.[0]?.text,
    status: c.status,
    start: c.period?.start,
  };
}

export function shapeGoal(r: FhirResource) {
  const g = r as Any;
  return {
    id: r.id,
    goal: g.description?.text,
    status: g.lifecycleStatus,
    dueDate: g.target?.[0]?.dueDate,
  };
}

export function shapeCoverage(r: FhirResource) {
  const c = r as Any;
  // FHIR Coverage.type is a CodeableConcept with a coding array; we surface
  // the .text (free-form display) if present, else the first coding's display.
  const typeCoding = c.type?.coding?.[0];
  const type = c.type?.text ?? typeCoding?.display ?? typeCoding?.code;
  return {
    id: r.id,
    status: c.status,
    type,
    payer: c.payer?.[0]?.display ?? c.payer?.display,
    subscriberId: c.subscriberId,
    periodStart: c.period?.start,
    periodEnd: c.period?.end,
    relationship: c.relationship?.coding?.[0]?.display ?? c.relationship?.coding?.[0]?.code,
  };
}
