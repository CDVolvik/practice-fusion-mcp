# 3. Ship a credential-free demo mode over fixtures

Status: accepted

## Context

Running the server meant holding live Practice Fusion credentials — a Veradigm
developer account and a registered signing key. That left no way for someone to
try the server, or evaluate it, without first standing up an EHR integration.
Directory sandboxes that offer to run it (for example Glama's "Try in Browser")
ask for those same credentials, and a `system/*.read` EHR key does not belong in a
sandbox that makes no privacy or persistence guarantees.

## Decision

Add a `--demo` mode (also `PF_DEMO=1`) that serves in-memory synthetic FHIR
fixtures instead of a live API. The tools depend on a small `FhirReader` interface;
`FhirClient` implements it against the network, and `FixtureFhirClient` implements
it against the fixtures. The boot path picks one based on the flag — nothing else
changes.

## Consequences

- Every tool, prompt, and resource can be exercised with no account, no network,
  and no PHI.
- The fixtures are seeded so the README's example query returns exactly what the
  README shows, which keeps the docs honest.
- The fixtures are a maintenance surface: a new tool that reads a new resource type
  needs fixture data to demo, and the seams are covered by tests.
- Introducing the `FhirReader` interface also made the tools trivially testable with
  a fake client, independent of the demo feature.
