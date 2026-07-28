import { z } from "zod";
import {
  formatConfigErrors,
  fromZodIssue,
  type ConfigError,
  type Result,
} from "./config-errors.js";

const schema = z.object({
  PF_FHIR_BASE_URL: z.string().url(),
  PF_TOKEN_URL: z.string().url(),
  PF_CLIENT_ID: z.string().min(1),
  PF_PRIVATE_KEY: z.string().min(1),
  PF_SCOPES: z.string().min(1).default("system/*.read"),
  PF_TOKEN_ALG: z.enum(["RS384", "RS256", "ES384"]).default("RS384"),
  PF_AUDIT_LOG: z.string().min(1).optional(),
  PF_AUDIT_LOG_FORMAT: z.enum(["text", "ndjson"]).default("text"),
  PF_RETRY_MAX_ATTEMPTS: z
    .string()
    .regex(/^\d+$/)
    .default("4")
    .transform((s) => Number(s))
    .pipe(z.number().int().min(1).max(10)),
  PF_RETRY_BASE_MS: z
    .string()
    .regex(/^\d+$/)
    .default("500")
    .transform((s) => Number(s))
    .pipe(z.number().int().min(0).max(60000)),
  PF_RETRY_CAP_MS: z
    .string()
    .regex(/^\d+$/)
    .default("8000")
    .transform((s) => Number(s))
    .pipe(z.number().int().min(0).max(300000)),
});

export interface Config {
  fhirBaseUrl: string;
  tokenUrl: string;
  clientId: string;
  privateKeyPem: string;
  scopes: string;
  tokenAlg: "RS384" | "RS256" | "ES384";
  auditLogPath?: string;
  auditLogFormat: "text" | "ndjson";
  retryMaxAttempts: number;
  retryBaseMs: number;
  retryCapMs: number;
}

export type LoadConfigResult = Result<Config, ConfigError[]>;

/** Parse the env into a Config. Never throws — returns errors so the boot path
 *  can render a friendly message. Use {@link loadConfigOrThrow} for the raw
 *  string error path (e.g. `--verbose` mode or programmatic callers). */
export function loadConfig(
  env: Record<string, string | undefined> = process.env,
): LoadConfigResult {
  const parsed = schema.safeParse(env);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues.map(fromZodIssue) };
  }
  const e = parsed.data;
  return {
    ok: true,
    value: {
      fhirBaseUrl: e.PF_FHIR_BASE_URL.replace(/\/$/, ""),
      tokenUrl: e.PF_TOKEN_URL,
      clientId: e.PF_CLIENT_ID,
      privateKeyPem: e.PF_PRIVATE_KEY,
      scopes: e.PF_SCOPES,
      tokenAlg: e.PF_TOKEN_ALG,
      auditLogPath: e.PF_AUDIT_LOG,
      auditLogFormat: e.PF_AUDIT_LOG_FORMAT,
      retryMaxAttempts: e.PF_RETRY_MAX_ATTEMPTS,
      retryBaseMs: e.PF_RETRY_BASE_MS,
      retryCapMs: e.PF_RETRY_CAP_MS,
    },
  };
}

/** Throwing variant for callers that want a string error. The format used here
 *  is the same as the boot-path friendly output. */
export function loadConfigOrThrow(env: Record<string, string | undefined> = process.env): Config {
  const result = loadConfig(env);
  if (!result.ok) {
    throw new Error(formatConfigErrors(result.error));
  }
  return result.value;
}
