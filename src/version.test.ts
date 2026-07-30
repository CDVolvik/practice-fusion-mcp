import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { readVersion } from "./version.js";

describe("readVersion", () => {
  it("returns the version declared in package.json", () => {
    const pkgPath = fileURLToPath(new URL("../package.json", import.meta.url));
    const pkg = JSON.parse(readFileSync(pkgPath, "utf8")) as { version: string };
    expect(readVersion()).toBe(pkg.version);
  });

  it("returns a semver-shaped string", () => {
    expect(readVersion()).toMatch(/^\d+\.\d+\.\d+/);
  });
});
