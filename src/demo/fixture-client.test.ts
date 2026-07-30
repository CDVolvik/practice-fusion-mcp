import { describe, it, expect } from "vitest";
import { FixtureFhirClient } from "./fixture-client.js";
import type { FhirResource } from "../fhir/client.js";

type Any = Record<string, any>;

describe("FixtureFhirClient", () => {
  const client = new FixtureFhirClient();

  it("finds the README example patient by name", async () => {
    const r = await client.search("Patient", { name: "Ana Rivera" });
    expect(r).toHaveLength(1);
    expect(r[0].id).toBe("abc123");
    expect((r[0] as Any).birthDate).toBe("1984-02-11");
  });

  it("returns Ana Rivera's two active medications, matching the README example", async () => {
    const r = await client.search("MedicationRequest", { patient: "abc123" });
    const names = r.map((m) => (m as Any).medicationCodeableConcept.text).sort();
    expect(names).toEqual(["Atorvastatin 20 mg", "Lisinopril 10 mg"]);
    expect(r.every((m) => (m as Any).status === "active")).toBe(true);
  });

  it("filters observations by category", async () => {
    const labs = await client.search("Observation", { patient: "abc123", category: "laboratory" });
    const vitals = await client.search("Observation", {
      patient: "abc123",
      category: "vital-signs",
    });
    expect(labs).toHaveLength(2);
    expect(vitals).toHaveLength(2);
  });

  it("scopes clinical resources to the requested patient", async () => {
    const ana = await client.search("Condition", { patient: "abc123" });
    const marcus = await client.search("Condition", { patient: "def456" });
    expect(ana).toHaveLength(2);
    expect(marcus).toHaveLength(1);
  });

  it("honours appointment date filters with FHIR prefixes", async () => {
    const after = await client.search("Appointment", { patient: "abc123", date: "ge2026-08-01" });
    const before = await client.search("Appointment", { patient: "abc123", date: "le2026-01-01" });
    expect(after).toHaveLength(1);
    expect(before).toHaveLength(0);
  });

  it("returns one result past the limit so has_more can be computed", async () => {
    const r = await client.search("Condition", { patient: "abc123" }, { limit: 1 });
    expect(r).toHaveLength(2);
  });

  it("reads a resource by id and rejects unknown ids with a 404", async () => {
    const p = await client.read("Patient", "abc123");
    expect((p as Any).name[0].family).toBe("Rivera");
    await expect(client.read("Patient", "does-not-exist")).rejects.toThrow(/404/);
  });

  it("everything() collects a patient's resources and does not leak other patients", async () => {
    const all = await client.everything("abc123");
    const types = new Set(all.map((r: FhirResource) => r.resourceType));
    expect(types.has("Condition")).toBe(true);
    expect(types.has("MedicationRequest")).toBe(true);
    expect(types.has("Coverage")).toBe(true);
    // Marcus Webb's medication (med-3) must not appear in Ana's $everything.
    expect(all.find((r) => r.id === "med-3")).toBeUndefined();
  });

  it("everything() respects the limit", async () => {
    const all = await client.everything("abc123", { limit: 3 });
    expect(all).toHaveLength(3);
  });
});
