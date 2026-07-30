/**
 * True when the server should run against in-memory demo fixtures instead of a
 * live Practice Fusion API — enabled by the `--demo` CLI flag or `PF_DEMO=1`.
 * Demo mode needs no credentials, makes no network calls, and touches no PHI.
 */
export function isDemoMode(
  argv: readonly string[] = process.argv,
  env: Record<string, string | undefined> = process.env,
): boolean {
  return argv.includes("--demo") || env.PF_DEMO === "1";
}
