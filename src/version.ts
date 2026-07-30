import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

/**
 * The server version, read from package.json at runtime so the startup banner
 * and the MCP handshake always report the published release rather than a
 * hand-maintained literal that can drift.
 */
export function readVersion(): string {
  const pkgPath = fileURLToPath(new URL("../package.json", import.meta.url));
  const pkg = JSON.parse(readFileSync(pkgPath, "utf8")) as { version: string };
  return pkg.version;
}
