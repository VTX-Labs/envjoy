import { describe, expect, it } from "vitest";
import { applyMissing, generateExample } from "../src/fix.js";
import { parseEnv } from "../src/parser.js";

describe("applyMissing", () => {
  it("appends only the missing keys using example placeholders", () => {
    const { content, added } = applyMissing("FOO=\nBAR=default\nBAZ=", "FOO=1");
    expect(added).toEqual(["BAR", "BAZ"]);
    const parsed = parseEnv(content);
    expect(parsed.map.get("FOO")).toBe("1"); // untouched
    expect(parsed.map.get("BAR")).toBe("default"); // placeholder from example
    expect(parsed.map.has("BAZ")).toBe(true);
  });

  it("is a no-op when nothing is missing", () => {
    const { content, added } = applyMissing("FOO=", "FOO=1");
    expect(added).toEqual([]);
    expect(content).toBe("FOO=1");
  });

  it("scaffolds from scratch when env is empty", () => {
    const { content, added } = applyMissing("A=\nB=", "");
    expect(added).toEqual(["A", "B"]);
    expect(parseEnv(content).map.has("A")).toBe(true);
  });

  it("quotes values that need it", () => {
    const { content } = applyMissing('KEY=has spaces', "");
    expect(content).toContain('KEY="has spaces"');
  });

  it("preserves existing content verbatim", () => {
    const original = "# my config\nFOO=1\n";
    const { content } = applyMissing("FOO=\nBAR=", original);
    expect(content.startsWith("# my config\nFOO=1\n")).toBe(true);
  });
});

describe("generateExample", () => {
  it("strips values but keeps keys", () => {
    const ex = generateExample("FOO=secret\nBAR=12345");
    const parsed = parseEnv(ex);
    expect(parsed.map.get("FOO")).toBe("");
    expect(parsed.map.get("BAR")).toBe("");
  });

  it("preserves comments and blank lines", () => {
    const ex = generateExample("# section\nFOO=secret\n\nBAR=x");
    expect(ex).toContain("# section");
    expect(ex.split(/\r?\n/).filter((l) => l === "").length).toBeGreaterThanOrEqual(1);
  });

  it("handles the export prefix and indentation", () => {
    const ex = generateExample("export FOO=secret");
    expect(ex).toContain("FOO=");
    expect(ex).not.toContain("secret");
  });

  it("ends with a single trailing newline", () => {
    const ex = generateExample("FOO=1");
    expect(ex.endsWith("\n")).toBe(true);
    expect(ex.endsWith("\n\n")).toBe(false);
  });

  it("does not leak multiline-value continuations as phantom keys", () => {
    const ex = generateExample('DB="host=localhost\npassword=secret"\nNEXT=ok');
    const parsed = parseEnv(ex);
    // Only the real keys survive — `password` must NOT become a key.
    expect([...parsed.map.keys()].sort()).toEqual(["DB", "NEXT"]);
    expect(parsed.map.get("DB")).toBe("");
  });
});

describe("applyMissing — line endings", () => {
  it("uses CRLF when the base file is CRLF", () => {
    const { content } = applyMissing("FOO=\nBAR=", "FOO=1\r\n");
    // Appended lines should match the file's CRLF style, not mix LF in.
    expect(content.includes("\r\n# Added by envjoy")).toBe(true);
    expect(/[^\r]\n# Added by envjoy/.test(content)).toBe(false);
  });
});
