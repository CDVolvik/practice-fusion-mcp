import { describe, it, expect, vi } from "vitest";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { registerAllTools } from "./tools/index.js";
import type { FhirClient } from "./fhir/client.js";
import { AuditLogger } from "./audit/logger.js";

/**
 * End-to-end over the real MCP protocol using a linked in-memory transport
 * pair: a Client and the server perform the initialize handshake, then we
 * exercise tools/list and tools/call. Deterministic (no subprocess), so it's
 * safe in CI while still proving the server actually speaks MCP.
 */
async function connect(searchImpl: () => Promise<unknown[]> = async () => []) {
  const server = new McpServer({ name: "practice-fusion-mcp", version: "test" });
  const client = {
    search: vi.fn().mockImplementation(searchImpl),
    read: vi.fn(),
    everything: vi.fn().mockResolvedValue([]),
  } as unknown as FhirClient;
  const audit = new AuditLogger();
  vi.spyOn(audit, "record").mockImplementation(() => {});
  registerAllTools(server, { client, audit });

  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  const mcpClient = new Client({ name: "test-client", version: "0" });
  await Promise.all([server.connect(serverTransport), mcpClient.connect(clientTransport)]);
  return { server, mcpClient };
}

describe("server integration (in-memory MCP transport)", () => {
  it("lists all 14 tools, each read-only with an output schema", async () => {
    const { server, mcpClient } = await connect();
    const { tools } = await mcpClient.listTools();

    expect(tools).toHaveLength(14);
    for (const tool of tools) {
      expect(tool.annotations?.readOnlyHint).toBe(true);
      expect(tool.outputSchema).toBeDefined();
    }
    expect(tools.map((t) => t.name)).toContain("practicefusion_search_patients");
    expect(tools.map((t) => t.name)).toContain("practicefusion_get_coverage");
    expect(tools.map((t) => t.name)).toContain("practicefusion_get_everything");

    await mcpClient.close();
    await server.close();
  });

  it("calls a tool end-to-end and returns structuredContent", async () => {
    const { server, mcpClient } = await connect(async () => [
      { resourceType: "Patient", id: "p1", name: [{ given: ["Ana"], family: "Rivera" }] },
    ]);

    const res = await mcpClient.callTool({
      name: "practicefusion_search_patients",
      arguments: { name: "rivera" },
    });

    const structured = res.structuredContent as { results: { name: string }[]; count: number };
    expect(structured.results[0].name).toBe("Ana Rivera");
    expect(structured.count).toBe(1);

    await mcpClient.close();
    await server.close();
  });
});
