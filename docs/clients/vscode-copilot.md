# VS Code + GitHub Copilot (Agent mode)

VS Code's built-in MCP support landed in 1.86 (2024) and works in any editor with GitHub Copilot Chat's **Agent mode** enabled. The config goes in a workspace `.vscode/mcp.json` and is scoped to the workspace.

## 1. Prerequisites

- VS Code 1.86 or later
- GitHub Copilot extension (the free tier includes Agent mode for some users; Copilot Pro is required for full agent use)
- Agent mode toggled on: open Copilot Chat, click the mode picker at the bottom of the input, choose **Agent**

## 2. Add the config

Create `.vscode/mcp.json` in your workspace root:

```json
{
  "servers": {
    "practice-fusion": {
      "type": "stdio",
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

Note the key is **`servers`**, not `mcpServers` — VS Code uses the shorter form.

## 3. Reload the window

`Cmd+Shift+P` / `Ctrl+Shift+P` → **Developer: Reload Window**. VS Code re-reads the MCP config on reload.

## 4. Verify

Open Copilot Chat, switch to **Agent** mode, and click the **tools** button (wrench icon). You should see the 14 `practicefusion_*` tools listed.

A smoke test:

> "Find patients named Ana Rivera"

Copilot should propose a tool call to `practicefusion_search_patients` — approve it and the result appears inline.

## Keeping credentials out of the workspace

`.vscode/mcp.json` is checked into git by default. To keep the PEM out of the repo:

1. Put the credential in your user settings (`settings.json` under `mcp.servers.practice-fusion.env`).
2. Or use the **Input Variables** feature: set `"PF_PRIVATE_KEY": "${input:pfKey}"` in `.vscode/mcp.json` — VS Code prompts for the value on first use and caches it in the OS keychain.

## Troubleshooting

- **Tools not appearing in Agent mode** — make sure you're actually in **Agent** mode (not Chat or Edit). The tools button is only visible in Agent.
- **"Server failed to start"** — VS Code's MCP log is in **Output → MCP Servers**. The deployer-friendly error banner from `practice-fusion-mcp` will name the env var that's wrong.
- **`${input:pfKey}` keeps prompting** — that's the intended security behavior. Accept it once per session.
- **Workspace settings vs user settings** — workspace `.vscode/mcp.json` overrides user settings. If the user settings have a working config and the workspace one is broken, comment out the workspace config temporarily to debug.

## Links

- [VS Code MCP docs](https://code.visualstudio.com/docs/copilot/chat/mcp-servers)
- [Main README](../../README.md)
- [Environment variables](../../README.md#environment-variables)
