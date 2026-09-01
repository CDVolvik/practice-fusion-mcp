# 5. Audit patient identifiers, redact free text

Status: accepted

## Context

Every tool call passes through the audit logger before it reaches the FHIR client.
That log is the only record of what an LLM client asked this server to read, so it
is the artifact a covered entity would reach for when accounting for disclosures
under HIPAA 164.528.

Two things pull in opposite directions. A log that records the parameters verbatim
holds Protected Health Information — a patient name or birthdate submitted to
`practicefusion_search_patients` is PHI the moment it is written. A log that strips
those parameters cannot answer "who was accessed", which is the one question an
accounting of disclosures exists to answer.

Free-text parameters are a third case. They are unbounded, callers put anything in
them, and they are where unexpected PHI turns up.

## Decision

Redact by length, not by field name. `sanitize()` in `audit/logger.ts` replaces any
string parameter longer than 64 characters with `[redacted:N]` and passes shorter
values through unchanged.

Short structured parameters — names, birthdates, identifiers — are therefore
recorded as sent, on purpose. Long free text is not.

Audit writes are best-effort: a failed `appendFileSync` is swallowed, because an
audit write failing must never take down a clinical read.

## Consequences

- The audit log is a PHI-bearing artifact. It must be stored, transported, and
  retained under the same controls as any other PHI, and this is stated in the
  README's known limits rather than left for a deployer to discover.
- The log can answer who was accessed, when, by which tool, and whether the call
  succeeded — enough for an accounting of disclosures.
- Length is a proxy for "free text", not a guarantee. A 200-character clinical note
  is redacted; a 40-character one is not. The threshold is a trade, not a boundary.
- Tokens, private keys, and credentials never reach the logger at all, so no
  redaction rule is load-bearing for secrets.
- A future deployer wanting a PHI-free log would need field-aware redaction keyed
  off each tool's schema. That is a larger change and is not planned.
