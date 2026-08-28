import { describe, it, expect, vi } from "vitest";
import { registerDirectoryTools } from "./directory.js";
import type { FhirClient } from "../fhir/client.js";
import { AuditLogger } from "../audit/logger.js";

function harness() {
  const handlers = new Map<string, (args: any) => Promise<any>>();
  const server = { registerTool: (n: string, _c: unknown, h: any) => handlers.set(n, h) };
  const client = { search: vi.fn(), read: vi.fn() } as unknown as FhirClient;
  const audit = new AuditLogger();
  vi.spyOn(audit, "record").mockImplementation(() => {});
  registerDirectoryTools(server as any, { client, audit });
  return { handlers, client };
}

describe("directory tools", () => {
  it("search_practitioners searches Practitioner by name", async () => {
    const { handlers, client } = harness();
    (client.search as any).mockResolvedValue([
      {
        resourceType: "Practitioner",
        id: "pr1",
        name: [{ given: ["Adam"], family: "Careful" }],
        telecom: [{ system: "phone", value: "787-555-0100" }],
        qualification: [{ code: { text: "MD" } }],
      },
    ]);
    const res = await handlers.get("practicefusion_search_practitioners")!({ name: "careful" });
    expect(client.search).toHaveBeenCalledWith("Practitioner", { name: "careful" }, { limit: 50 });
    expect(res.structuredContent.results[0].name).toBe("Adam Careful");
    expect(res.structuredContent.results[0].qualification).toBe("MD");
  });
});
