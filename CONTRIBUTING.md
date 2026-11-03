# Contributing

Thanks for your interest in improving practice-fusion-mcp.

## Development setup

```bash
pnpm install
pnpm test          # unit tests (mocked FHIR — no credentials needed)
pnpm typecheck     # tsc --noEmit
pnpm lint          # eslint
pnpm format        # prettier --write
pnpm build         # bundle to dist/
```

You do **not** need live Practice Fusion credentials to develop or test — the
test suite mocks the FHIR client. To run against a real EHR, copy
`.env.example` to `.env` and fill in your backend-services app details.

## Before you open a PR

CI runs Prettier, ESLint, typecheck, tests, and build on Node 22 and 24. Run the
equivalent locally:

```bash
pnpm format:check && pnpm lint && pnpm typecheck && pnpm test && pnpm build
```

`pnpm hooks:install` (once per clone) runs the first three before every `git push`,
about 11 seconds, so formatting, lint and type errors never reach CI.

- Add or update tests for any behavior change. Every tool has a mock-based test;
  follow the existing pattern in `src/tools/*.test.ts`.
- Keep tools read-only. This server intentionally exposes no write operations.
- Never commit secrets. `*.pem`, `.env`, and JWKS files are gitignored.

## Adding a new tool

1. Add a shaper in `src/fhir/shapers.ts` that maps the FHIR resource to a small,
   flat summary.
2. Register the tool in the appropriate `src/tools/*.ts` file with a
   `practicefusion_` prefix, a typed `outputSchema`, the `READ_ONLY`
   annotations, and (for lists) the shared `limit` parameter + `paged()` helper.
3. Add a mock-based test and update the tool count in `src/tools/index.test.ts`.
4. Add the tool to the README table.

## Commit messages

Conventional Commits are preferred (`feat:`, `fix:`, `chore:`, `docs:`).
