import { describe, expect, it } from "vitest";
import { diffEnv } from "../src/diff.js";

describe("diffEnv", () => {
  it("reports a clean sync when env matches example", () => {
    const d = diffEnv("FOO=\nBAR=", "FOO=1\nBAR=2");
    expect(d.inSync).toBe(true);
    expect(d.ok).toEqual(["FOO", "BAR"]);
    expect(d.missing).toEqual([]);
  });

  it("detects missing keys (in example, not in env)", () => {
    const d = diffEnv("FOO=\nBAR=\nBAZ=", "FOO=1");
    expect(d.missing).toEqual(["BAR", "BAZ"]);
    expect(d.inSync).toBe(false);
  });

  it("detects extra keys (in env, not in example)", () => {
    const d = diffEnv("FOO=", "FOO=1\nEXTRA=2");
    expect(d.extra).toEqual(["EXTRA"]);
    expect(d.inSync).toBe(false);
  });

  it("detects empty values in env", () => {
    const d = diffEnv("FOO=\nBAR=", "FOO=1\nBAR=");
    expect(d.empty).toEqual(["BAR"]);
    expect(d.inSync).toBe(false);
  });

  it("can ignore extras with checkExtra:false", () => {
    const d = diffEnv("FOO=", "FOO=1\nEXTRA=2", { checkExtra: false });
    expect(d.extra).toEqual([]);
    expect(d.inSync).toBe(true);
  });

  it("can ignore empties with checkEmpty:false", () => {
    const d = diffEnv("FOO=", "FOO=", { checkEmpty: false });
    expect(d.empty).toEqual([]);
    expect(d.ok).toEqual(["FOO"]);
    expect(d.inSync).toBe(true);
  });

  it("respects the ignore list", () => {
    const d = diffEnv("FOO=\nNODE_ENV=", "FOO=1\nPORT=3000", { ignore: ["NODE_ENV", "PORT"] });
    expect(d.missing).toEqual([]);
    expect(d.extra).toEqual([]);
    expect(d.inSync).toBe(true);
  });

  it("surfaces duplicate keys from both files", () => {
    const d = diffEnv("FOO=\nFOO=", "FOO=1\nBAR=2\nBAR=3");
    expect(d.duplicates.example).toContain("FOO");
    expect(d.duplicates.actual).toContain("BAR");
  });

  it("treats an empty env file as everything-missing", () => {
    const d = diffEnv("A=\nB=\nC=", "");
    expect(d.missing).toEqual(["A", "B", "C"]);
  });
});
