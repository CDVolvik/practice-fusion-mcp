# 4. Return shaped summaries, not raw FHIR

Status: accepted

## Context

FHIR resources are deeply nested and verbose — a single `MedicationRequest` can run
to dozens of fields across several code systems. Handing raw FHIR back to a language
model spends context on structure it does not need and makes the useful fields
harder to find.

## Decision

Each tool returns a small shaped summary — a handful of the fields that matter for
the task — produced by a dedicated shaper in `fhir/shapers.ts`, with a typed
`outputSchema` and `structuredContent` so clients receive real objects. List tools
paginate with a `limit` and report `count` and `has_more`.

## Consequences

- Output is compact, typed, and chainable: a client can take an id from one call and
  feed it to the next without parsing prose.
- Shaping drops fields some callers might want. `practicefusion_get_everything` is
  the escape hatch — it returns raw resources (bounded) for a fuller picture.
- Each new resource type needs a shaper, which is a small, well-patterned unit of
  work and is unit-tested.
- Pagination and the `$everything` cap mean no single call can pull an unbounded
  dataset into the model's context.
