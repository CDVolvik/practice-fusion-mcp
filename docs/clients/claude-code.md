# Claude Code

Claude Code is Anthropic's terminal-based coding agent. It reads MCP servers from one of three places: a global config, a per-project `.mcp.json`, or the `claude mcp add` CLI. The CLI is the simplest path.

## 1. Install Claude Code

```bash
npm install -g @anthropic-ai/claude-code
claude auth login
```

See [docs.claude.com/claude-code](https://docs.claude.com/en/docs/claude-code) for the full setup.

## 2. Add the MCP server

**Easiest path** — run this in any directory; the server is added to your **user** config (~/.claude.json) and is available in every project:

```bash
claude mcp add practice-fusion \
  -e PF_FHIR_BASE_URL=https://fhir.practicefusion.com/r4 \
  -e PF_TOKEN_URL=https://auth.practicefusion.com/token \
  -e PF_CLIENT_ID=your-client-id \
  -e PF_PRIVATE_KEY="$(cat ~/.ssh/pf_private_key.pem)" \
  -- npx -y practice-fusion-mcp
```

The `--` separates Claude Code flags from the server's own command. The single-quoted `$(cat ...)` is the PEM contents on one line with real newlines — Claude Code passes it as a string with embedded `\n` automatically.

**Per-project path** — create `.mcp.json` at the project root so the server is scoped to that repo:

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

If the PEM contains a real new key, prefer the CLI form (which uses `$(cat ...)`) over pasting into JSON.

## 3. Verify

```bash
claude mcp list
```

Should print `practice-fusion: npx -y practice-fusion-mcp - ✓ connected`. If you see `✗ failed to connect`, the env vars are wrong — see _Troubleshooting_.

In an interactive session, ask:

> "Find patients named Ana Rivera"

Claude should call `practicefusion_search_patients`.

## Project-scoped vs user-scoped

`claude mcp add` writes to your user config. To scope to a project, use `.mcp.json` in the project root (checked into git) or `.mcp.local.json` (gitignored, for credentials). Claude Code prefers `.mcp.local.json` over `.mcp.json` if both exist.

## Troubleshooting

- **"failed to connect"** — run `claude mcp get practice-fusion` to see the resolved config. Then `npx -y practice-fusion-mcp` directly in a terminal to see the same "configuration error" banner the MCP client would surface.
- **PEM with real newlines in JSON** — Claude Code's JSON parser does the right thing; if you see a parse error, replace literal newlines with `\n` in the value.
- **Per-project config not picked up** — make sure the file is named exactly `.mcp.json` (or `.mcp.local.json`) at the project root, with no leading underscore.
- **Server restarts every few minutes** — that's normal; Claude Code respawns the stdio process on inactivity.

## Links

- [Claude Code MCP docs](https://docs.claude.com/en/docs/claude-code/mcp)
- [Main README](../../README.md)
- [Environment variables](../../README.md#environment-variables)
