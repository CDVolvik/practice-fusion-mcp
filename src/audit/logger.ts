import { appendFileSync } from "node:fs";

export interface AuditEntry {
  tool: string;
  params: Record<string, unknown>;
  outcome: "ok" | "error";
  error?: string;
}

export type AuditFormat = "text" | "ndjson";

const MAX_PARAM_LEN = 64;

function sanitize(params: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(params)) {
    if (typeof v === "string" && v.length > MAX_PARAM_LEN) {
      out[k] = `[redacted:${v.length}]`;
    } else {
      out[k] = v;
    }
  }
  return out;
}

interface NormalizedEntry {
  ts: string;
  tool: string;
  params: Record<string, unknown>;
  outcome: "ok" | "error";
  error?: string;
}

function normalize(entry: AuditEntry): NormalizedEntry {
  const base: NormalizedEntry = {
    ts: new Date().toISOString(),
    tool: entry.tool,
    params: sanitize(entry.params),
    outcome: entry.outcome,
  };
  if (entry.error) base.error = entry.error;
  return base;
}

function formatText(e: NormalizedEntry): string {
  const lines = [`[${e.ts}] ${e.tool} (${e.outcome})`, `  params: ${JSON.stringify(e.params)}`];
  if (e.error) lines.push(`  error: ${e.error}`);
  return lines.join("\n") + "\n";
}

function formatNdjson(e: NormalizedEntry): string {
  return JSON.stringify(e) + "\n";
}

export class AuditLogger {
  constructor(
    private readonly filePath?: string,
    private readonly fileFormat: AuditFormat = "text",
  ) {}

  record(entry: AuditEntry): void {
    const normalized = normalize(entry);
    // stderr always gets the human-readable text format (humans tailing a
    // process should not have to parse JSON to see what just happened).
    process.stderr.write(formatText(normalized));
    // File output is configurable; ndjson is what SIEM / log aggregators
    // want, text is the back-compat default.
    if (this.filePath) {
      const line = this.fileFormat === "ndjson" ? formatNdjson(normalized) : formatText(normalized);
      try {
        appendFileSync(this.filePath, line);
      } catch {
        /* file logging is best-effort; never throw from audit */
      }
    }
  }
}
