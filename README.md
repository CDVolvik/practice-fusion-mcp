<p align="center">
  <img src="assets/banner.svg" alt="practice-fusion-mcp — FHIR-first, read-only MCP server for Practice Fusion" width="100%">
</p>

# practice-fusion-mcp

[![CI](https://github.com/kushaim/practice-fusion-mcp/actions/workflows/ci.yml/badge.svg)](https://github.com/kushaim/practice-fusion-mcp/actions/workflows/ci.yml)
[![Glama score](https://glama.ai/mcp/servers/kushaim/practice-fusion-mcp/badges/score.svg)](https://glama.ai/mcp/servers/kushaim/practice-fusion-mcp)
![License: MIT](https://img.shields.io/badge/license-MIT-green)
![Node](https://img.shields.io/badge/node-%3E%3D22-brightgreen?logo=nodedotjs&logoColor=white)
![MCP](https://img.shields.io/badge/MCP-server-0a0a14)
![FHIR R4](https://img.shields.io/badge/FHIR-R4-orange)
![Access](https://img.shields.io/badge/access-read--only-blue)

An open-source, **FHIR-first, read-only** [Model Context Protocol](https://modelcontextprotocol.io) server for **Practice Fusion**. Connect Claude (Desktop / Code), Cursor, or any MCP client to a Practice Fusion EHR to search patients and providers and review appointments, conditions, medications, labs, vitals, allergies, immunizations, encounters, documents, procedures, diagnostic reports, care plans, and goals — running on Practice Fusion's **free Open FHIR account**.

Read-only by design. Audit-logged. No write access, no scheduling, no patient creation.

## Contents

- [Architecture](#architecture)
- [Tools](#tools)
- [Prompts & resources](#prompts--resources)
- [Example](#example)
- [Demo mode](#demo-mode)
- [Setup](#setup)
  - [Environment variables](#environment-variables)
  - [MCP clients](#mcp-clients)
  - [Troubleshooting](#troubleshooting)
- [Security & HIPAA](#security--hipaa)
- [How it differs from the alternative](#how-it-differs-from-the-alternative)
- [Development](#development)

## Architecture

```mermaid
flowchart LR
    C["MCP client<br/>Claude Desktop / Code · Cursor"] -- stdio --> S

    subgraph S["practice-fusion-mcp"]
      direction TB
      T["18 read tools<br/>patients · providers · appointments<br/>conditions · meds · labs · vitals<br/>allergies · immunizations · encounters<br/>documents · coverage · procedures · reports<br/>care plans · goals · everything"]
      A["Audit logger<br/>stderr + optional file<br/>PHI-redacted"]
      F["FHIR client<br/>Bundle unwrap · shapers<br/>pagination · sanitized errors"]
      TP["SMART backend-services<br/>TokenProvider<br/>signed JWT assertion · token cache"]
      T -. audited .-> A
      T --> F
      F --> TP
    end

    TP -- "OAuth2 client-credentials" --> AUTH["PF token endpoint"]
    F -- "read-only FHIR R4" --> PF["Practice Fusion<br/>Open FHIR API"]
    AUTH -- access token --> F
```

Every tool call flows through the audit logger; the FHIR client only ever holds a short-lived token minted from a signed JWT assertion (SMART backend-services), and long free-text parameters are redacted before anything is logged.

## Tools

All tools are namespaced with a `practicefusion_` prefix (so they don't collide when loaded alongside other MCP servers), carry a `readOnlyHint` annotation, and return a typed `outputSchema` / `structuredContent`. List tools accept an optional `limit` (default 50, max 200) and report `count` and `has_more`.

**Patients & providers**

| Tool                                  | What it does                                            |
| ------------------------------------- | ------------------------------------------------------- |
| `practicefusion_search_patients`      | Find patients by name / birthdate / gender / identifier |
| `practicefusion_get_patient`          | One patient's demographics by id                        |
| `practicefusion_search_practitioners` | Find providers by name / identifier                     |

**Clinical**

| Tool                               | What it does                         |
| ---------------------------------- | ------------------------------------ |
| `practicefusion_get_conditions`    | A patient's problems / diagnoses     |
| `practicefusion_get_medications`   | A patient's medication requests      |
| `practicefusion_get_lab_results`   | A patient's laboratory observations  |
| `practicefusion_get_vitals`        | A patient's vital-sign observations  |
| `practicefusion_get_allergies`     | A patient's allergies & intolerances |
| `practicefusion_get_immunizations` | A patient's immunizations            |

**Records**

| Tool                              | What it does                                           |
| --------------------------------- | ------------------------------------------------------ |
| `practicefusion_get_appointments` | Appointments by patient / status / date                |
| `practicefusion_get_encounters`   | A patient's clinical encounters (visits)               |
| `practicefusion_get_documents`    | A patient's document references (note metadata)        |
| `practicefusion_get_coverage`     | A patient's insurance Coverage (status, payer, period) |

**Summary**

| Tool                            | What it does                                                                                                                                         |
| ------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| `practicefusion_get_everything` | Pre-visit summary for a single patient — per-type counts plus a bounded sample of raw resources (FHIR `$everything` with a per-type-search fallback) |

**Procedures & care planning**

| Tool                                    | What it does                                   |
| --------------------------------------- | ---------------------------------------------- |
| `practicefusion_get_procedures`         | A patient's procedures                         |
| `practicefusion_get_diagnostic_reports` | A patient's diagnostic (lab / imaging) reports |
| `practicefusion_get_care_plans`         | A patient's care plans                         |
| `practicefusion_get_goals`              | A patient's care goals                         |

## Prompts & resources

Beyond tools, the server exposes the other two MCP primitives.

**Prompts** — ready-made templates a client can surface:

| Prompt              | Args        | What it does                                                                                             |
| ------------------- | ----------- | -------------------------------------------------------------------------------------------------------- |
| `pre_visit_summary` | `patientId` | Guides the assistant to assemble a one-minute pre-visit summary from the read tools                      |
| `medication_review` | `patientId` | Reviews a patient's medications against their problems and allergies (decision support, not prescribing) |

**Resources** — readable by URI:

| Resource        | URI                                            | What it returns                                                  |
| --------------- | ---------------------------------------------- | ---------------------------------------------------------------- |
| Patient summary | `practicefusion://patient/{patientId}/summary` | Every resource linked to a patient (FHIR `$everything`), as JSON |

Resource reads are audit-logged like tool calls.

## Example

Ask an MCP client a question and it composes the tools:

> **You:** What are Ana Rivera's active medications?

```jsonc
// 1. resolve the patient
practicefusion_search_patients { "name": "Ana Rivera" }
// → { "results": [{ "id": "abc123", "name": "Ana Rivera", "birthDate": "1984-02-11" }], "count": 1, "has_more": false }

// 2. read her medications
practicefusion_get_medications { "patientId": "abc123" }
// → { "results": [
//      { "medication": "Lisinopril 10 mg", "status": "active" },
//      { "medication": "Atorvastatin 20 mg", "status": "active" }
//    ], "count": 2, "has_more": false }
```

> **Assistant:** Ana Rivera has 2 active medications: Lisinopril 10 mg and Atorvastatin 20 mg.

Because every tool returns `structuredContent`, the client gets typed objects — not just text — so it can chain calls reliably.

## Demo mode

You can run everything above with no Practice Fusion account. Demo mode serves in-memory synthetic fixtures — no credentials, no network, no PHI — and the example query returns exactly what's shown.

From a clone:

```bash
pnpm install
pnpm dev --demo
```

Or point an MCP client at the built server with the `--demo` flag (or set `PF_DEMO=1` in its `env`):

```json
{
  "mcpServers": {
    "practice-fusion-demo": {
      "command": "node",
      "args": ["/absolute/path/to/practice-fusion-mcp/dist/index.js", "--demo"]
    }
  }
}
```

The fixtures cover two patients across every resource type — conditions, medications, labs, vitals, allergies, immunizations, appointments, encounters, documents, and coverage — so each tool returns something. It's the quickest way to see the tools before wiring real credentials.

## Setup

1. Register a free Practice Fusion **Open FHIR** developer account and create a **System / backend-services** app. Note your FHIR base URL, token URL, client id, and register your app's public key.
2. Provide the environment variables below. In production, use your MCP client's `env` block (shown in step 3). For local development, copy `.env.example` to `.env` — `pnpm dev` loads it automatically.
3. Add to your MCP client config, e.g. Claude Desktop:

```json
{
  "mcpServers": {
    "practice-fusion": {
      "command": "npx",
      "args": ["-y", "practice-fusion-mcp"],
      "env": {
        "PF_FHIR_BASE_URL": "https://fhir.practicefusion.com/r4",
        "PF_TOKEN_URL": "https://auth.practicefusion.com/token",
        "PF_CLIENT_ID": "your-client-id",
        "PF_PRIVATE_KEY": "-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----"
      }
    }
  }
}
```

### Environment variables

| Var                     | Required | Default         | Notes                                                                                                                                        |
| ----------------------- | -------- | --------------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| `PF_FHIR_BASE_URL`      | yes      | —               | FHIR R4 base URL                                                                                                                             |
| `PF_TOKEN_URL`          | yes      | —               | OAuth2 token endpoint                                                                                                                        |
| `PF_CLIENT_ID`          | yes      | —               | Backend-services client id                                                                                                                   |
| `PF_PRIVATE_KEY`        | yes      | —               | PKCS8 PEM private key (matches the registered public key)                                                                                    |
| `PF_SCOPES`             | no       | `system/*.read` | Requested scopes                                                                                                                             |
| `PF_TOKEN_ALG`          | no       | `RS384`         | JWT signing alg                                                                                                                              |
| `PF_AUDIT_LOG`          | no       | —               | Optional file path for audit records (always also written to stderr)                                                                         |
| `PF_AUDIT_LOG_FORMAT`   | no       | `text`          | Audit log file format: `text` (multi-line, human-readable) or `ndjson` (one JSON object per line, SIEM-friendly). stderr always uses `text`. |
| `PF_RETRY_MAX_ATTEMPTS` | no       | `4`             | Total attempts for transient FHIR responses (429/502/503/504). 1 = no retry.                                                                 |
| `PF_RETRY_BASE_MS`      | no       | `500`           | Initial backoff in ms. Doubles each attempt (500 → 1000 → 2000 …) up to `PF_RETRY_CAP_MS`.                                                   |
| `PF_RETRY_CAP_MS`       | no       | `8000`          | Maximum backoff between retries. `Retry-After` from the server is always honored.                                                            |

## MCP clients

The server speaks the [Model Context Protocol](https://modelcontextprotocol.io) over stdio, so it works in any MCP client that supports a local `command + args + env` config. Pick your client:

| Client                                | Tested | Setup                                                                                                                                             |
| ------------------------------------- | :----: | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| Claude Desktop                        |   ✅   | [`docs/clients/claude-desktop.md`](docs/clients/claude-desktop.md)                                                                                |
| Claude Code                           |   ✅   | [`docs/clients/claude-code.md`](docs/clients/claude-code.md)                                                                                      |
| Cursor                                |   ✅   | [`docs/clients/cursor.md`](docs/clients/cursor.md)                                                                                                |
| VS Code + GitHub Copilot (Agent mode) |   ✅   | [`docs/clients/vscode-copilot.md`](docs/clients/vscode-copilot.md)                                                                                |
| OpenCode                              |   ✅   | below — _Other clients_                                                                                                                           |
| Codex CLI                             |   ✅   | below — _Other clients_                                                                                                                           |
| Cline / Roo Cline                     |   ✅   | below — _Other clients_                                                                                                                           |
| Windsurf                              |   ✅   | below — _Other clients_                                                                                                                           |
| Continue.dev                          |   ✅   | below — _Other clients_                                                                                                                           |
| T3 code                               |   —    | GUI wrapper — install the MCP server in the underlying agent (Codex, Claude, Cursor, or OpenCode); the configs above apply                        |
| R21 Hermes Agent (R21-internal)       |   ✅   | below — _R21 fleet_                                                                                                                               |
| R21 OpenClaw host (R21-internal)      |   —    | host (not a client) — install the MCP server in whichever agent runs on the machine (Claude Code / OpenCode / Codex CLI); the configs above apply |

The same `PF_*` environment variables apply everywhere. The package is published on npm, so every config uses the same `command: npx` / `args: ["-y", "practice-fusion-mcp"]` pair; only the file location and JSON key (`mcpServers` vs `servers` vs `mcp` etc.) differ.

### Other clients (one-liner configs)

All five use the same `{ command, args, env }` shape. Only the config file location and JSON key differ.

**OpenCode** — global `~/.config/opencode/config.json` or per-project `opencode.json`:

```json
{
  "mcp": {
    "practice-fusion": {
      "type": "local",
      "command": ["npx", "-y", "practice-fusion-mcp"],
      "environment": {
        "PF_FHIR_BASE_URL": "https://fhir.practicefusion.com/r4",
        "PF_TOKEN_URL": "https://auth.practicefusion.com/token",
        "PF_CLIENT_ID": "your-client-id",
        "PF_PRIVATE_KEY": "-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----"
      }
    }
  }
}
```

**Codex CLI** — `~/.codex/config.toml`:

```toml
[mcp_servers.practice-fusion]
command = "npx"
args = ["-y", "practice-fusion-mcp"]

[mcp_servers.practice-fusion.env]
PF_FHIR_BASE_URL = "https://fhir.practicefusion.com/r4"
PF_TOKEN_URL = "https://auth.practicefusion.com/token"
PF_CLIENT_ID = "your-client-id"
PF_PRIVATE_KEY = """-----BEGIN PRIVATE KEY-----
...your key...
-----END PRIVATE KEY-----"""
```

**Cline / Roo Cline** — Cline MCP settings panel, or `.cline/mcp_settings.json` directly (same shape as Claude Desktop — see [Setup](#setup)).

**Windsurf** — `~/.codeium/windsurf/mcp_config.json` (same shape as Claude Desktop).

**Continue.dev** — `~/.continue/config.json` under the `mcpServers` key (same shape as Claude Desktop).

### Models

`practice-fusion-mcp` is model-agnostic — it doesn't care which LLM sits behind the client. Use Anthropic Claude (in any of the above clients), OpenAI GPT (Codex, Cursor, Continue), Google Gemini (Continue, Cline), local Ollama models, or **NVIDIA Nemotron** served via NIM inside any of the clients that accept a custom OpenAI-compatible endpoint (most do). The model you pick only changes answer quality, not which tools the server exposes.

### R21 fleet

The maintainer (R21 Digital) runs practice-fusion-mcp across two R21-internal surfaces:

- **Hermes Agent** — R21's multi-agent orchestration. Wire the MCP server into the Hermes sub-agent that handles healthcare/EHR work; the `npx -y practice-fusion-mcp` invocation is wrapped in a Make.com scenario or a Hermes tool spec. The deployer-friendly error banner (see [Troubleshooting](#troubleshooting)) plays well with Hermes' tool-call surfaces.
- **OpenClaw** — one of the R21 fleet machines. OpenClaw is a host, not a client — the right setup is whichever agent runs there (typically Claude Code or OpenCode on the R21 fleet). Use the per-client config above for whichever agent you launch the MCP from.

For deeper R21-internal deployment notes (Make.com scenarios, Hermes sub-agent patterns, fleet-wide credential rotation), see the R21-internal `docs/clients/hermes.md` and `docs/clients/openclaw.md` (R21 Digital workspace, not this public repo).

## Troubleshooting

If the server fails to start, the boot path prints a deployer-friendly error instead of a raw Zod dump. Each line names the env var and the fix:

```
practicefusion-mcp: configuration error
  ✗ PF_CLIENT_ID: required env var is missing
      Set it in your MCP client config or .env, e.g. the client_id from your SMART backend-services app
  ✗ PF_PRIVATE_KEY: required env var is missing
      Key must start with -----BEGIN PRIVATE KEY----- and be PKCS8 format
  ✗ PF_FHIR_BASE_URL: Invalid URL
      Must be a URL, e.g. https://fhir.practicefusion.com/r4
  … and 2 more (set PF_VERBOSE=1 for full output)
```

Values are never echoed — only the env var name. Set `PF_VERBOSE=1` in your MCP client config to get the raw Zod issue tree when the friendly output isn't enough. The server exits 1 on any configuration error so the host can surface it.

## Security & HIPAA

This server handles Protected Health Information. **You**, the deployer, are the covered entity or business associate: you are responsible for your own Business Associate Agreement (BAA) with Veradigm/Practice Fusion and for running this in a HIPAA-appropriate environment. Every tool call is audit-logged (stderr, plus optional file) with long free-text parameters redacted. Tokens and keys are never logged. This project ships code, not a hosted data service. See [SECURITY.md](SECURITY.md) for details. **Not legal advice.**

## How it differs from the alternative

The other way to reach a Practice Fusion EHR is the proprietary Unity APIs. The official Practice Fusion Integrator tier is built on them and needs a Veradigm partnership; community MCP servers built on the same APIs have shown up in the directories too, and they tend to be **read-write** — creating patients, booking appointments, editing insurance.

This server takes the FHIR route instead. It runs on Practice Fusion's **free** Open FHIR account with no partnership, and it is **read-only** and **audit-logged** on purpose: a deliberately small risk surface for putting an EHR behind an LLM. If you need to write data or manage scheduling, a proprietary-API server will fit you better; if you want EHR reads you can reason about, this is the one.

## Related MCP servers

If you arrived here looking for "any Practice Fusion MCP" and now want the wider FHIR / EHR / healthcare MCP landscape:

- [wso2/fhir-mcp-server](https://github.com/wso2/fhir-mcp-server) — generic FHIR R4 MCP server, language-agnostic, MIT.
- [the-momentum/fhir-mcp-server](https://github.com/the-momentum/fhir-mcp-server) — FHIR MCP server for medical data standards.
- [erikhoward/azure-fhir-mcp-server](https://github.com/erikhoward/azure-fhir-mcp-server) — FHIR R4 against Azure Health Data Services (similar shape, Microsoft stack).
- [jcafazzo/fhir-mcp](https://github.com/jcafazzo/fhir-mcp) — enhanced FHIR MCP with data-quality assessment and broader clinical coverage.
- [DhairyaShah981/fhir-mcp](https://github.com/DhairyaShah981/fhir-mcp) — clinical-data bridge with reversible keyed de-identification and CDS Hooks.

Glama's [MCP directory](https://glama.ai/mcp/servers) lists all of these plus ~62k others. This server is on Glama as [practice-fusion-mcp](https://glama.ai/mcp/servers/kushaim/practice-fusion-mcp).

## Development

```bash
pnpm install
pnpm test          # unit tests (mocked FHIR — no credentials needed)
pnpm typecheck     # tsc --noEmit
pnpm lint          # eslint
pnpm format        # prettier --write
pnpm build         # bundle to dist/
```

CI (GitHub Actions) runs Prettier, ESLint, typecheck, tests, and build on Node 20 and 22. See [CONTRIBUTING.md](CONTRIBUTING.md) to add a tool, and [docs/adr](docs/adr/) for the architecture decisions behind the design.
