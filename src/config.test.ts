import { describe, it, expect } from "vitest";
import { loadConfig, loadConfigOrThrow } from "./config.js";
import { formatConfigErrors, fromZodIssue } from "./config-errors.js";

const base = {
  PF_FHIR_BASE_URL: "https://fhir.example.com/r4",
  PF_TOKEN_URL: "https://auth.example.com/token",
  PF_CLIENT_ID: "client-123",
  PF_PRIVATE_KEY: "-----BEGIN PRIVATE KEY-----\nabc\n-----END PRIVATE KEY-----",
};

describe("loadConfig", () => {
  it("returns ok with defaults applied for scope, alg, and retry", () => {
    const r = loadConfig(base);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.value.scopes).toBe("system/*.read");
    expect(r.value.tokenAlg).toBe("RS384");
    expect(r.value.auditLogPath).toBeUndefined();
    expect(r.value.auditLogFormat).toBe("text");
    expect(r.value.retryMaxAttempts).toBe(4);
    expect(r.value.retryBaseMs).toBe(500);
    expect(r.value.retryCapMs).toBe(8000);
    expect(r.value.fhirBaseUrl).toBe("https://fhir.example.com/r4");
    expect(r.value.tokenUrl).toBe("https://auth.example.com/token");
  });

  it("strips a trailing slash from fhirBaseUrl", () => {
    const r = loadConfig({ ...base, PF_FHIR_BASE_URL: "https://fhir.example.com/r4/" });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.value.fhirBaseUrl).toBe("https://fhir.example.com/r4");
  });

  it("parses retry env vars as numbers", () => {
    const r = loadConfig({
      ...base,
      PF_RETRY_MAX_ATTEMPTS: "6",
      PF_RETRY_BASE_MS: "250",
      PF_RETRY_CAP_MS: "4000",
    });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.value.retryMaxAttempts).toBe(6);
    expect(r.value.retryBaseMs).toBe(250);
    expect(r.value.retryCapMs).toBe(4000);
  });

  it("returns errors for out-of-range retry values, not throws", () => {
    const r1 = loadConfig({ ...base, PF_RETRY_MAX_ATTEMPTS: "0" });
    expect(r1.ok).toBe(false);
    if (r1.ok) return;
    expect(r1.error[0].envVar).toBe("PF_RETRY_MAX_ATTEMPTS");
    expect(r1.error[0].category).toBe("out_of_range");

    const r2 = loadConfig({ ...base, PF_RETRY_MAX_ATTEMPTS: "99" });
    expect(r2.ok).toBe(false);

    const r3 = loadConfig({ ...base, PF_RETRY_BASE_MS: "abc" });
    expect(r3.ok).toBe(false);
    if (r3.ok) return;
    expect(r3.error[0].envVar).toBe("PF_RETRY_BASE_MS");
  });

  it("returns a missing-category error when a required var is absent", () => {
    const r = loadConfig({ ...base, PF_CLIENT_ID: undefined });
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.error[0].envVar).toBe("PF_CLIENT_ID");
    expect(r.error[0].category).toBe("missing");
  });

  it("returns an invalid-format error for a malformed URL", () => {
    const r = loadConfig({ ...base, PF_FHIR_BASE_URL: "not-a-url" });
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.error[0].envVar).toBe("PF_FHIR_BASE_URL");
    expect(r.error[0].category).toBe("invalid_format");
  });

  it("returns an invalid-enum error for a bad token alg", () => {
    const r = loadConfig({ ...base, PF_TOKEN_ALG: "HS256" });
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.error[0].envVar).toBe("PF_TOKEN_ALG");
    expect(r.error[0].category).toBe("invalid_enum");
  });

  it("uses a PEM-friendly message for PF_PRIVATE_KEY format failures", () => {
    const r = loadConfig({ ...base, PF_PRIVATE_KEY: "" });
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.error[0].envVar).toBe("PF_PRIVATE_KEY");
    expect(r.error[0].message).toMatch(/required env var is missing/);
  });
});

describe("formatConfigErrors", () => {
  it("prints a banner and one line per error with a deployer hint", () => {
    const errors = [
      {
        envVar: "PF_CLIENT_ID",
        category: "missing" as const,
        message: "PF_CLIENT_ID: required env var is missing",
        hint: "Set it in your MCP client config or .env",
      },
    ];
    const out = formatConfigErrors(errors);
    expect(out).toContain("practicefusion-mcp: configuration error");
    expect(out).toContain("PF_CLIENT_ID: required env var is missing");
    expect(out).toContain("Set it in your MCP client config or .env");
  });

  it("never echoes env var values, only names", () => {
    const errors = [
      {
        envVar: "PF_FHIR_BASE_URL",
        category: "invalid_format" as const,
        message: "PF_FHIR_BASE_URL: Invalid url",
        hint: "x",
      },
    ];
    const out = formatConfigErrors(errors);
    expect(out).not.toContain("not-a-url");
    expect(out).toContain("PF_FHIR_BASE_URL");
  });

  it("caps output at 5 errors by default and shows the overflow hint", () => {
    const errors = Array.from({ length: 8 }, (_, i) => ({
      envVar: `PF_VAR_${i}`,
      category: "missing" as const,
      message: `PF_VAR_${i}: missing`,
      hint: "x",
    }));
    const out = formatConfigErrors(errors);
    expect(out.match(/✗/g)?.length).toBe(5);
    expect(out).toContain("… and 3 more");
    expect(out).toContain("PF_VERBOSE=1");
  });

  it("renders all errors when max is raised", () => {
    const errors = Array.from({ length: 8 }, (_, i) => ({
      envVar: `PF_VAR_${i}`,
      category: "missing" as const,
      message: `PF_VAR_${i}: missing`,
      hint: "x",
    }));
    const out = formatConfigErrors(errors, { max: 100 });
    expect(out.match(/✗/g)?.length).toBe(8);
  });

  it("appends the raw Zod tree when raw is provided", () => {
    const errors = [
      {
        envVar: "PF_CLIENT_ID",
        category: "missing" as const,
        message: "PF_CLIENT_ID: required env var is missing",
        hint: "x",
      },
    ];
    const fakeRaw = {
      issues: [{ path: ["PF_CLIENT_ID"], message: "expected string, received undefined" }],
    } as unknown as import("zod").ZodError;
    const out = formatConfigErrors(errors, { raw: fakeRaw });
    expect(out).toContain("Raw issues:");
    expect(out).toContain("PF_CLIENT_ID: expected string, received undefined");
  });
});

describe("fromZodIssue", () => {
  it("classifies a missing string as 'missing'", () => {
    // Real Zod 4 issue shape: invalid_type + message "Invalid input: expected
    // string, received undefined" — no `received` field on the object.
    const err = fromZodIssue({
      code: "invalid_type",
      path: ["PF_CLIENT_ID"],
      message: "Invalid input: expected string, received undefined",
      expected: "string",
    } as unknown as Parameters<typeof fromZodIssue>[0]);
    expect(err.category).toBe("missing");
    expect(err.envVar).toBe("PF_CLIENT_ID");
    expect(err.hint).toBeTruthy();
  });

  it("classifies a too-small number as 'out_of_range'", () => {
    const err = fromZodIssue({
      code: "too_small",
      path: ["PF_RETRY_MAX_ATTEMPTS"],
      message: "Too small: expected number to be >=1",
      origin: "number",
      minimum: 1,
      inclusive: true,
    } as unknown as Parameters<typeof fromZodIssue>[0]);
    expect(err.category).toBe("out_of_range");
  });

  it("classifies an invalid enum as 'invalid_enum'", () => {
    const err = fromZodIssue({
      code: "invalid_value",
      path: ["PF_TOKEN_ALG"],
      message: "Invalid option: expected one of RS384|RS256|ES384",
      values: ["RS384", "RS256", "ES384"],
    } as unknown as Parameters<typeof fromZodIssue>[0]);
    expect(err.category).toBe("invalid_enum");
  });
});

describe("loadConfigOrThrow", () => {
  it("returns the config on success", () => {
    const cfg = loadConfigOrThrow(base);
    expect(cfg.clientId).toBe("client-123");
  });

  it("throws a formatted error on failure", () => {
    expect(() => loadConfigOrThrow({ ...base, PF_CLIENT_ID: undefined })).toThrow(
      /practicefusion-mcp: configuration error/,
    );
    expect(() => loadConfigOrThrow({ ...base, PF_CLIENT_ID: undefined })).toThrow(/PF_CLIENT_ID/);
  });
});
