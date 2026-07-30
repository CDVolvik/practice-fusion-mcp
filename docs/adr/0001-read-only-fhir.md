# 1. Build on the free Open FHIR API, read-only

Status: accepted

## Context

Practice Fusion exposes two integration paths. The **Open FHIR** API is a free,
standards-based (SMART on FHIR) read interface. The **Unity** API is a
proprietary read/write interface that requires a Veradigm partnership. Connecting
an EHR to a language model puts a large, sensitive dataset one tool call away from
an autonomous agent, so the blast radius of a mistake is the design's first
concern.

## Decision

Build only on the Open FHIR API, and expose reads only. No writes, no scheduling,
no patient creation. Every tool carries a `readOnlyHint` annotation, and there is
no code path that issues a mutating FHIR request.

## Consequences

- Runs on a free account with no partnership or contract.
- The risk surface is small and easy to reason about: the worst a compromised or
  confused client can do is read data it was already granted.
- Users who need to write data or manage appointments are not served here and
  should use a Unity-based server. The README says so plainly.
- Read-only is a property of the whole codebase, not a runtime flag — there is
  nothing to misconfigure into a write.
