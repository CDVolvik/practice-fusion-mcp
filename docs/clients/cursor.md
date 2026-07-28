# Cursor

Cursor ships with built-in MCP support. There are two scopes — **project** (`.cursor/mcp.json` in the workspace, recommended so the config is checked in alongside the rest of the project setup) and **global** (`~/.cursor/mcp.json` for the user).

## 1. Install Cursor

If you don't have it yet: [cursor.com](https://cursor.com). MCP is built in; no extension needed.

## 2. Add the config

For a project-scoped config, create `.cursor/mcp.json` in the project root:

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

For a global config, write the same JSON to `~/.cursor/mcp.json` (no project root).

## 3. Reload the window

Open the command palette (`Cmd+Shift+P` / `Ctrl+Shift+P`) → **Developer: Reload Window**. Cursor only re-reads the MCP config on reload.

## 4. Verify

Open the **Cursor** tab in the right sidebar (or hit `Cmd+L`) — under **MCP Tools** you should see `practice-fusion` with 14 sub-tools. Click any one to inspect its schema.

A smoke test:

> "Find patients named Ana Rivera"

Cursor should call `practicefusion_search_patients`.

## Troubleshooting

- **Tools not showing in the sidebar** — most often a JSON syntax error. Run `node -e "JSON.parse(require('fs').readFileSync('.cursor/mcp.json'))"` in the project root to validate.
- **"Server disconnected" in the sidebar** — the server started but the MCP handshake failed. Open the **Output → Cursor MCP** panel for the stdio log; the deployer-friendly error banner from `practice-fusion-mcp` will name the offending env var.
- **Want the PEM out of git** — put it in `.env` and reference it from a startup script, or use Cursor's **User Secrets** feature to keep credentials out of the project file.
- **Project vs global confusion** — the project config takes precedence. To debug, `rm .cursor/mcp.json` and re-add; the global config will then apply.

## Links

- [Cursor MCP docs](https://docs.cursor.com/en/model-context-protocol)
- [Main README](../../README.md)
- [Environment variables](../../README.md#environment-variables)
