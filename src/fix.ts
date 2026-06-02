/**
 * Mutation helpers: bring an env file in sync, or generate an example from one.
 *
 * These operate on strings (pure) so they're trivially testable; the CLI is
 * the only thing that touches the filesystem.
 */

import { parseEnv } from "./parser.js";

/** Detect the dominant newline of a file so edits don't mix CRLF and LF. */
function detectNewline(content: string): string {
  return content.includes("\r\n") ? "\r\n" : "\n";
}

export interface ApplyMissingResult {
  /** The new env-file content with missing keys appended. */
  content: string;
  /** Keys that were appended. */
  added: string[];
}

/**
 * Append keys that exist in the example but are missing from the actual env.
 * Each appended key uses the example's value as a placeholder (so secrets are
 * never copied from a real env — the example holds only placeholders).
 *
 * Existing content is preserved verbatim; new keys are appended under a header.
 */
export function applyMissing(exampleContent: string, actualContent: string): ApplyMissingResult {
  const example = parseEnv(exampleContent);
  const actual = parseEnv(actualContent);
  const nl = detectNewline(actualContent);

  const added: string[] = [];
  const lines: string[] = [];

  for (const entry of example.entries) {
    if (!actual.map.has(entry.key)) {
      added.push(entry.key);
      lines.push(formatAssignment(entry.key, entry.value));
    }
  }

  if (added.length === 0) {
    return { content: actualContent, added };
  }

  const base = ensureTrailingNewline(actualContent, nl);
  const header = `# Added by envjoy${nl}`;
  const block = lines.join(nl) + nl;
  return { content: `${base}${base === "" ? "" : nl}${header}${block}`, added };
}

/**
 * Produce an `.env.example` from an actual `.env`, stripping values so only the
 * key names (with empty placeholders) are committed. Comments and blank lines
 * from the source are preserved to keep the example readable.
 *
 * Uses the real parser so multiline-quoted values are understood: a value that
 * spans several lines collapses to a single `KEY=` line, and its continuation
 * lines never leak through as phantom keys.
 */
export function generateExample(actualContent: string): string {
  const text = actualContent.charCodeAt(0) === 0xfeff ? actualContent.slice(1) : actualContent;
  const nl = detectNewline(text);
  const parsed = parseEnv(text);

  // Map each 1-based line that *starts* a declaration to its key. Any other
  // line is either a comment/blank (kept verbatim) or a value-continuation
  // line (skipped, because its declaration already produced a `KEY=`).
  const keyByLine = new Map<number, string>();
  for (const e of parsed.entries) keyByLine.set(e.line, e.key);

  // Determine, per source line, whether it was consumed as a continuation.
  const lines = text.split(/\r\n|\n|\r/);
  const consumed = markConsumedLines(lines);

  const out: string[] = [];
  for (let i = 0; i < lines.length; i++) {
    const lineNo = i + 1;
    if (keyByLine.has(lineNo)) {
      const indent = (lines[i] ?? "").match(/^\s*/)?.[0] ?? "";
      out.push(`${indent}${keyByLine.get(lineNo) as string}=`);
    } else if (consumed.has(lineNo)) {
      // Continuation of a multiline value — drop it.
      continue;
    } else {
      out.push(lines[i] ?? ""); // comment or blank, kept verbatim
    }
  }
  while (out.length > 1 && out[out.length - 1] === "") out.pop();
  return out.join(nl) + nl;
}

/** Identify line numbers (1-based) that are continuations of a multiline value. */
function markConsumedLines(lines: string[]): Set<number> {
  const consumed = new Set<number>();
  const decl = /^\s*(?:export\s+)?[A-Za-z_][A-Za-z0-9_.]*\s*=(.*)$/s;
  for (let i = 0; i < lines.length; i++) {
    const m = decl.exec(lines[i] ?? "");
    if (!m) continue;
    const rhs = (m[1] ?? "").replace(/^[ \t]+/, "");
    const q = rhs[0];
    if (q !== '"' && q !== "'" && q !== "`") continue;
    // Does it close on the same line?
    if (closesOnSameLine(rhs.slice(1), q)) continue;
    // Walk forward marking continuation lines until the quote closes.
    for (let j = i + 1; j < lines.length; j++) {
      consumed.add(j + 1);
      if (containsClose(lines[j] ?? "", q)) {
        i = j; // resume scanning after the closing line
        break;
      }
    }
  }
  return consumed;
}

function closesOnSameLine(fragment: string, quote: string): boolean {
  return containsClose(fragment, quote);
}

function containsClose(fragment: string, quote: string): boolean {
  for (let k = 0; k < fragment.length; k++) {
    const ch = fragment[k];
    if (ch === "\\" && quote === '"') {
      k++;
      continue;
    }
    if (ch === quote) return true;
  }
  return false;
}

function formatAssignment(key: string, value: string): string {
  // Quote values that contain whitespace or special chars to stay loader-safe.
  if (value === "" || /^[A-Za-z0-9_./:@-]+$/.test(value)) {
    return `${key}=${value}`;
  }
  const escaped = value.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
  return `${key}="${escaped}"`;
}

function ensureTrailingNewline(content: string, nl: string): string {
  if (content === "") return "";
  return /\r?\n$/.test(content) ? content : content + nl;
}
