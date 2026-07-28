# Claude Desktop

Claude Desktop is Anthropic's reference MCP client. The setup uses a single JSON config file; once it's in place, restart the app and the 14 tools (`practicefusion_get_*`, `practicefusion_search_*`) appear in the chat.

## 1. Install Claude Desktop

If you don't have it yet: [claude.ai/download](https://claude.ai/download). The MCP client is built in; no extension needed.

## 2. Edit the config file

The config lives at:

| OS      | Path                                                              |
| ------- | ----------------------------------------------------------------- |
| macOS   | `~/Library/Application Support/Claude/claude_desktop_config.json` |
| Windows | `%APPDATA%\Claude\claude_desktop_config.json`                     |
| Linux   | `~/.config/Claude/claude_desktop_config.json`                     |

If the file doesn't exist, create it. If it does, merge the `mcpServers` block into the existing object.

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

Replace the four values with the credentials from your Practice Fusion Open FHIR app. The PEM private key must be PKCS8 (`-----BEGIN PRIVATE KEY-----` header, not `RSA PRIVATE KEY`).

## 3. Restart Claude Desktop

The app reads the config only on launch. Quit fully (`Cmd+Q` on macOS, full window close on Windows) and reopen.

## 4. Verify

In any chat, click the **+** next to the attachment row → the **Practice Fusion** section should show 14 tools. If it shows fewer than 14 (typically 0), see _Troubleshooting_ below.

A quick smoke test:

> "Find patients named Ana Rivera"

Claude should call `practicefusion_search_patients` and return a structured list.

## Troubleshooting

- **Zero tools loaded** — the most common cause is a JSON syntax error in the config file. Validate with `python -m json.tool < ~/.config/Claude/claude_desktop_config.json` (or the OS-specific path).
- **"Configuration error" appears in a red banner at chat start** — the server started but your env vars are wrong. See the [Troubleshooting section in the README](../README.md#troubleshooting) for the per-field error format.
- **PEM parse failed** — Claude Desktop passes the env-var value as a string; newlines in the PEM must be the literal `\n` sequence, not a real line break. If you pasted the key with real newlines, JSON-ify it: `"\n".join(open("key.pem").read().splitlines())`.
- **Tools appear but every call returns 403** — Practice Fusion's SMART backend-services auth requires the public key registered with the app to match the private key you put in `PF_PRIVATE_KEY`. Re-check the keypair.

## Links

- [Anthropic MCP docs](https://modelcontextprotocol.io/docs/develop/connect-local-servers)
- [Main README](../README.md)
- [Environment variables](../README.md#environment-variables)
