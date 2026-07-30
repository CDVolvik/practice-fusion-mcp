import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { loadConfig } from "./config.js";
import { formatConfigErrors } from "./config-errors.js";
import { AuditLogger } from "./audit/logger.js";
import { TokenProvider } from "./auth/backend-auth.js";
import { FhirClient } from "./fhir/client.js";
import { registerAllTools } from "./tools/index.js";
import { readVersion } from "./version.js";

async function main(): Promise<void> {
  const result = loadConfig();
  if (!result.ok) {
    console.error(formatConfigErrors(result.error));
    process.exit(1);
  }
  const config = result.value;
  const audit = new AuditLogger(config.auditLogPath, config.auditLogFormat);
  const tokens = new TokenProvider({
    tokenUrl: config.tokenUrl,
    clientId: config.clientId,
    privateKeyPem: config.privateKeyPem,
    scopes: config.scopes,
    alg: config.tokenAlg,
  });
  const client = new FhirClient(config.fhirBaseUrl, tokens, {
    retryMaxAttempts: config.retryMaxAttempts,
    retryBaseMs: config.retryBaseMs,
    retryCapMs: config.retryCapMs,
  });

  const server = new McpServer({ name: "practice-fusion-mcp", version: readVersion() });
  const toolCount = registerAllTools(server, { client, audit });

  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error(
    `practice-fusion-mcp: ready (${toolCount} tools, audit=${config.auditLogPath ? "file" : "stderr"}, retry=${config.retryMaxAttempts}/${config.retryBaseMs}ms-${config.retryCapMs}ms)`,
  );
}

main().catch((e) => {
  console.error("fatal:", e instanceof Error ? e.message : e);
  process.exit(1);
});
