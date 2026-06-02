import { describe, expect, it } from "vitest";
import { parseEnv } from "../src/parser.js";

describe("parseEnv", () => {
  it("parses simple key=value pairs", () => {
    const r = parseEnv("FOO=bar\nBAZ=qux");
    expect(r.map.get("FOO")).toBe("bar");
    expect(r.map.get("BAZ")).toBe("qux");
    expect(r.entries).toHaveLength(2);
  });

  it("trims whitespace around keys and unquoted values", () => {
    const r = parseEnv("  FOO  =   bar   ");
    expect(r.map.get("FOO")).toBe("bar");
  });

  it("supports the `export` prefix", () => {
    const r = parseEnv("export TOKEN=abc123");
    expect(r.map.get("TOKEN")).toBe("abc123");
  });

  it("treats blank lines and comments as no-ops", () => {
    const r = parseEnv("# comment\n\nFOO=bar\n   # indented comment\n");
    expect(r.entries).toHaveLength(1);
    expect(r.map.get("FOO")).toBe("bar");
  });

  it("strips inline comments on unquoted values", () => {
    const r = parseEnv("FOO=bar # trailing comment");
    expect(r.map.get("FOO")).toBe("bar");
  });

  it("strips from the first # like dotenv, even without a leading space", () => {
    expect(parseEnv("FOO=bar#x").map.get("FOO")).toBe("bar");
    expect(parseEnv("URL=http://x.com#frag").map.get("URL")).toBe("http://x.com");
  });

  it("keeps # inside quoted values", () => {
    const r = parseEnv('PASS="a#b#c"');
    expect(r.map.get("PASS")).toBe("a#b#c");
  });

  it("preserves whitespace inside quotes", () => {
    const r = parseEnv("FOO='  spaced  '");
    expect(r.map.get("FOO")).toBe("  spaced  ");
  });

  it("expands escapes only inside double quotes", () => {
    expect(parseEnv('A="line1\\nline2"').map.get("A")).toBe("line1\nline2");
    expect(parseEnv("B='line1\\nline2'").map.get("B")).toBe("line1\\nline2");
  });

  it("handles multiline double-quoted values", () => {
    const r = parseEnv('KEY="first\nsecond\nthird"\nNEXT=ok');
    expect(r.map.get("KEY")).toBe("first\nsecond\nthird");
    expect(r.map.get("NEXT")).toBe("ok");
  });

  it("detects empty values", () => {
    const r = parseEnv("EMPTY=\nQUOTED_EMPTY=''");
    expect(r.entries.find((e) => e.key === "EMPTY")?.isEmpty).toBe(true);
    expect(r.entries.find((e) => e.key === "QUOTED_EMPTY")?.isEmpty).toBe(true);
  });

  it("records duplicate keys, last value wins", () => {
    const r = parseEnv("FOO=1\nFOO=2");
    expect(r.map.get("FOO")).toBe("2");
    expect(r.duplicates).toContain("FOO");
  });

  it("ignores a UTF-8 BOM", () => {
    const r = parseEnv("﻿FOO=bar");
    expect(r.map.get("FOO")).toBe("bar");
  });

  it("handles CRLF line endings", () => {
    const r = parseEnv("FOO=bar\r\nBAZ=qux\r\n");
    expect(r.map.get("FOO")).toBe("bar");
    expect(r.map.get("BAZ")).toBe("qux");
  });

  it("does not throw on malformed lines", () => {
    expect(() => parseEnv("this is not valid\n=missingkey\nFOO=ok")).not.toThrow();
    expect(parseEnv("garbage\nFOO=ok").map.get("FOO")).toBe("ok");
  });

  it("records the line number of each key", () => {
    const r = parseEnv("# header\nFOO=1\nBAR=2");
    expect(r.entries.find((e) => e.key === "FOO")?.line).toBe(2);
    expect(r.entries.find((e) => e.key === "BAR")?.line).toBe(3);
  });

  it("handles an empty file", () => {
    const r = parseEnv("");
    expect(r.entries).toHaveLength(0);
    expect(r.map.size).toBe(0);
  });
});
