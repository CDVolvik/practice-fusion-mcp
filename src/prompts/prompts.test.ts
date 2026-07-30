import { describe, it, expect } from "vitest";
import { preVisitSummaryPrompt, medicationReviewPrompt, registerPrompts } from "./prompts.js";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

describe("prompt builders", () => {
  it("pre-visit summary embeds the patient id and references the read tools", () => {
    const p = preVisitSummaryPrompt("abc123");
    expect(p.messages[0].role).toBe("user");
    const text = p.messages[0].content.text;
    expect(text).toContain("abc123");
    expect(text).toContain("practicefusion_get_medications");
    expect(text).toContain("practicefusion_get_allergies");
  });

  it("medication review embeds the patient id and stays non-prescriptive", () => {
    const p = medicationReviewPrompt("def456");
    const text = p.messages[0].content.text;
    expect(text).toContain("def456");
    expect(text.toLowerCase()).toContain("not a prescribing recommendation");
  });
});

describe("registerPrompts", () => {
  it("registers both prompt templates", () => {
    const names: string[] = [];
    const server = { registerPrompt: (n: string) => names.push(n) } as unknown as McpServer;
    const count = registerPrompts(server);
    expect(count).toBe(2);
    expect(names).toEqual(["pre_visit_summary", "medication_review"]);
  });
});
