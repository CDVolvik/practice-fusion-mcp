import { describe, it, expect } from "vitest";
import { isDemoMode } from "./mode.js";

describe("isDemoMode", () => {
  it("is off with no flag and no env", () => {
    expect(isDemoMode([], {})).toBe(false);
  });

  it("is on with the --demo flag", () => {
    expect(isDemoMode(["node", "index.js", "--demo"], {})).toBe(true);
  });

  it("is on with PF_DEMO=1", () => {
    expect(isDemoMode([], { PF_DEMO: "1" })).toBe(true);
  });

  it("treats PF_DEMO values other than 1 as off", () => {
    expect(isDemoMode([], { PF_DEMO: "0" })).toBe(false);
    expect(isDemoMode([], { PF_DEMO: "true" })).toBe(false);
  });
});
