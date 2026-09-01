# Security Policy

## Reporting a vulnerability

Please report security issues privately via GitHub Security Advisories
([**Report a vulnerability**](https://github.com/CDVolvik/practice-fusion-mcp/security/advisories/new))
rather than opening a public issue. You'll get an acknowledgement within a few
business days.

## Supported versions

The latest `0.x` release receives security fixes. Older versions do not.

## How this project handles PHI

This server touches Protected Health Information, so its security posture is
part of its design, not an afterthought:

- **Read-only.** No tool writes, schedules, or creates data. The FHIR scope
  defaults to `system/*.read`.
- **No data at rest.** The server ships code, not a hosted data service. It
  holds only a short-lived access token in memory, minted per run from a signed
  JWT assertion (SMART backend-services). Nothing is persisted.
- **Audit logging.** Every tool call is logged (stderr, plus an optional file)
  with an outcome. Long free-text parameters are redacted, and tokens and
  private keys are never logged.
- **Sanitized errors.** FHIR errors surface as status codes, not raw upstream
  payloads, so PHI can't leak through an error message.
- **Secrets via env only.** The private key is provided through `PF_PRIVATE_KEY`
  and validated at startup; it is never committed and is gitignored.

## Dependency advisories

Open Dependabot alerts on this repository are, as of 0.4.0, all transitive
through `@modelcontextprotocol/sdk`'s HTTP transport dependencies: `hono`, and
`ip-address` by way of `express-rate-limit`.

This server only ever constructs a `StdioServerTransport`. It never instantiates
an HTTP or SSE transport, so that code neither runs nor ships — the published
bundle contains no reference to any of those packages. Check it yourself:

```bash
pnpm build
grep -c -E "hono|express-rate-limit|ip-address" dist/index.js   # 0
```

Reachability is a reason not to panic, not a reason to skip the bump. Advisories
are still cleared as the SDK ships updated dependencies.

## Deployer responsibilities

You, the deployer, are the covered entity or business associate. You are
responsible for your own Business Associate Agreement (BAA) with
Veradigm/Practice Fusion and for running this in a HIPAA-appropriate
environment. This document is not legal advice.
