# Changelog

All notable changes to this project are documented here. The format is based on
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project
adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Security

- Cleared every open advisory; `pnpm audit` now reports no known vulnerabilities
  for production and dev alike. Two were reachable from the published package —
  `fast-uri` (via `ajv`) and `@hono/node-server`, both pulled in by
  `@modelcontextprotocol/sdk`. The rest were build and test tooling only:
  `vitest`, `vite`, `esbuild`, and `brace-expansion` (via `eslint`).
- `@modelcontextprotocol/sdk` moved to `^1.30.0` and `vitest` to `^3.2.7`. The
  remaining fixes are transitive, so they are pinned through `pnpm.overrides`.
  Every override sits inside the range its parent already declares — `ajv` asks
  for `fast-uri@^3.0.1`, and the SDK already permits
  `@hono/node-server@^1.19.9 || ^2.0.5` — so nothing is forced past a
  maintainer's stated compatibility.
- No runtime behaviour changed: 121 tests, typecheck, lint, and build all pass,
  and the built server still handshakes over stdio and lists all eighteen tools.

## [0.4.0] - 2026-07-30

### Added

- Four more read tools, broadening coverage to eighteen:
  `practicefusion_get_procedures`, `practicefusion_get_diagnostic_reports`,
  `practicefusion_get_care_plans`, and `practicefusion_get_goals`. The
  `$everything` fallback covers the new resource types too.
- MCP prompts and resources alongside the tools: `pre_visit_summary` and
  `medication_review` prompt templates, and a `patient-summary` resource at
  `practicefusion://patient/{patientId}/summary` (audit-logged like tool calls).
- Demo mode (`--demo` or `PF_DEMO=1`): runs every tool against in-memory
  synthetic FHIR fixtures with no Practice Fusion account, no credentials, and
  no PHI. The fixtures are seeded so the README example runs verbatim.

### Fixed

- The startup banner reported a fixed `13 tools` while fourteen were
  registered, and the MCP version was a hand-maintained literal. Both now derive
  from source: the tool count is summed from the registrars, and the version is
  read from `package.json`.

## [0.3.0]

### Added

- Six new read tools, broadening FHIR coverage to twelve:
  `practicefusion_get_vitals`, `practicefusion_get_allergies`,
  `practicefusion_get_immunizations`, `practicefusion_get_encounters`,
  `practicefusion_get_documents`, and `practicefusion_search_practitioners`.
- Continuous integration (GitHub Actions): Prettier, ESLint, typecheck, tests,
  and build across Node 20 and 22.
- ESLint + Prettier configuration, `SECURITY.md`, `CONTRIBUTING.md`, a
  changelog, issue/PR templates, an `.editorconfig`, and Dependabot.

## [0.2.0]

### Changed

- **Breaking:** all tools are now namespaced with a `practicefusion_` prefix to
  avoid collisions when loaded alongside other MCP servers.

### Added

- Tool annotations (`readOnlyHint`, `idempotentHint`, `openWorldHint`,
  `destructiveHint: false`) on every tool.
- Typed `outputSchema` + `structuredContent` on every tool.
- Pagination: an optional `limit` parameter (default 50, max 200) plus `count`
  and `has_more` in the output; the FHIR client now stops paging early instead
  of accumulating the whole result set in memory.
- Actionable error hints and richer tool/parameter descriptions.

## [0.1.0]

### Added

- Initial release: FHIR-first, read-only MCP server for Practice Fusion with six
  tools (patients, appointments, conditions, medications, lab results).
- SMART backend-services authentication (signed JWT assertion, token cache).
- PHI-redacted audit logging and sanitized FHIR errors.
