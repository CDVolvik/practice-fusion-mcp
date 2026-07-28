import type { z } from "zod";

/** Discriminated result for operations that can fail with a structured error. */
export type Result<T, E> = { ok: true; value: T } | { ok: false; error: E };

/** Severity bucket for a single config-parse failure. */
export type ConfigErrorCategory =
  "missing" | "invalid_format" | "out_of_range" | "invalid_enum" | "unknown";

/** A single env-var configuration problem, with a deployer-facing message + hint. */
export interface ConfigError {
  envVar: string;
  category: ConfigErrorCategory;
  message: string;
  hint: string;
}

const HINTS: Record<string, string> = {
  PF_FHIR_BASE_URL: "Must be a URL, e.g. https://fhir.practicefusion.com/r4",
  PF_TOKEN_URL: "Must be a URL, e.g. https://auth.practicefusion.com/token",
  PF_CLIENT_ID:
    "Set it in your MCP client config or .env, e.g. the client_id from your SMART backend-services app",
  PF_PRIVATE_KEY: "Key must start with -----BEGIN PRIVATE KEY----- and be PKCS8 format",
  PF_SCOPES: "Default: system/*.read",
  PF_TOKEN_ALG: "Must be one of: RS384 (default), RS256, ES384",
  PF_AUDIT_LOG: "Optional: file path for audit records (always also written to stderr)",
  PF_AUDIT_LOG_FORMAT: "Must be one of: text (default), ndjson",
  PF_RETRY_MAX_ATTEMPTS: "Must be a number 1-10, default 4",
  PF_RETRY_BASE_MS: "Must be a number 0-60000, default 500",
  PF_RETRY_CAP_MS: "Must be a number 0-300000, default 8000",
};

const GENERIC_HINT = "Check the README's Environment variables section";

/** Map a Zod issue to a deployer-facing ConfigError. */
export function fromZodIssue(issue: z.core.$ZodIssue): ConfigError {
  const envVar = String(issue.path[0] ?? "<root>");
  const category = categorise(issue);
  return {
    envVar,
    category,
    message: humanMessage(envVar, issue),
    hint: HINTS[envVar] ?? GENERIC_HINT,
  };
}

function categorise(issue: z.core.$ZodIssue): ConfigErrorCategory {
  if (issue.code === "invalid_type") {
    // Zod 4 marks a missing required field with `invalid_type` plus a message
    // that contains "received undefined" — there is no `received` field on
    // the issue object itself, so we match on the message.
    if ((issue.message ?? "").includes("received undefined")) return "missing";
  }
  if (issue.code === "too_small" || issue.code === "too_big") {
    return "out_of_range";
  }
  if (issue.code === "invalid_value" && "values" in issue) {
    return "invalid_enum";
  }
  if (issue.code === "invalid_format") {
    return "invalid_format";
  }
  return "unknown";
}

function humanMessage(envVar: string, issue: z.core.$ZodIssue): string {
  // PEM-specific: distinguish "missing" from "wrong format" with deployer-friendly
  // language instead of the raw Zod strings.
  if (envVar === "PF_PRIVATE_KEY") {
    if (issue.code === "invalid_type" || issue.code === "too_small") {
      // Both `undefined` and `""` are reported as "required env var is missing" —
      // an empty key is not a usable PEM, so the fix is the same.
      return "PF_PRIVATE_KEY: required env var is missing";
    }
    if (issue.code === "invalid_format" || issue.code === "custom") {
      return "PF_PRIVATE_KEY: PEM parse failed (check BEGIN marker, PKCS8 format)";
    }
  }
  return `${envVar}: ${issue.message}`;
}

/** Render a list of config errors as a multi-line deployer-facing message. */
export function formatConfigErrors(
  errors: ConfigError[],
  opts: { max?: number; raw?: z.ZodError } = {},
): string {
  const max = opts.max ?? 5;
  const lines: string[] = ["practicefusion-mcp: configuration error"];
  const shown = errors.slice(0, max);
  for (const e of shown) {
    lines.push(`  ✗ ${e.message}`);
    lines.push(`      ${e.hint}`);
  }
  if (errors.length > max) {
    lines.push(`  … and ${errors.length - max} more (set PF_VERBOSE=1 for full output)`);
  }
  if (opts.raw) {
    lines.push("");
    lines.push("Raw issues:");
    for (const issue of opts.raw.issues) {
      lines.push(`  ${String(issue.path[0])}: ${issue.message}`);
    }
  }
  return lines.join("\n");
}
