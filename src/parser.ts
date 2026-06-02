/**
 * A dotenv-compatible `.env` parser.
 *
 * Follows the documented semantics of the `dotenv` package so envjoy treats
 * files exactly the way your app's loader will:
 *  - `KEY=value` pairs, optional `export ` prefix.
 *  - Whitespace around the key and around unquoted values is trimmed.
 *  - Single- and double-quoted values preserve inner whitespace; double quotes
 *    expand `\n` and `\r` escape sequences.
 *  - Triple/-multiline quoted values are supported (value spans lines until the
 *    matching closing quote).
 *  - Full-line and inline `#` comments are ignored (a `#` inside a quoted value
 *    is literal; an unquoted inline `#` starts a comment).
 *  - Blank lines are ignored.
 *
 * The parser is intentionally dependency-free and lossless about *which* keys
 * exist and whether their value is empty — that is all envjoy needs.
 */

export interface ParsedEntry {
  /** The variable name. */
  key: string;
  /** The parsed value (may be an empty string). */
  value: string;
  /** 1-based line number where the key was defined. */
  line: number;
  /** Whether the value resolved to an empty string. */
  isEmpty: boolean;
}

export interface ParseResult {
  /** Insertion-ordered entries. Later duplicates overwrite earlier ones in `map`. */
  entries: ParsedEntry[];
  /** Convenience map of key -> value (last definition wins, dotenv behavior). */
  map: Map<string, string>;
  /** Keys that appeared more than once. */
  duplicates: string[];
}

const LINE = /\r\n|\n|\r/;

/** Matches a `KEY=...` declaration, capturing the key and the raw remainder. */
const DECL = /^\s*(?:export\s+)?([A-Za-z_][A-Za-z0-9_.]*)\s*=(.*)$/s;

/**
 * Parse the contents of a `.env`-style file.
 *
 * Never throws: malformed lines are skipped rather than aborting, because a
 * partially-valid env file should still surface the keys it does define.
 */
export function parseEnv(input: string): ParseResult {
  const entries: ParsedEntry[] = [];
  const map = new Map<string, string>();
  const seen = new Set<string>();
  const duplicates: string[] = [];

  // Strip a UTF-8 BOM if present.
  const text = input.charCodeAt(0) === 0xfeff ? input.slice(1) : input;
  const rawLines = text.split(LINE);

  for (let i = 0; i < rawLines.length; i++) {
    const lineNo = i + 1;
    const raw = rawLines[i] ?? "";
    const trimmed = raw.trimStart();

    // Skip blanks and whole-line comments.
    if (trimmed === "" || trimmed.startsWith("#")) continue;

    const m = DECL.exec(raw);
    if (!m) continue; // Not a recognizable declaration; ignore.

    const key = m[1] as string;
    let rest = m[2] ?? "";

    // Determine whether the value is quoted, and consume across lines if so.
    const { value, consumedLines } = readValue(rest, rawLines, i);
    if (consumedLines > 0) i += consumedLines;

    const entry: ParsedEntry = {
      key,
      value,
      line: lineNo,
      isEmpty: value.length === 0,
    };
    entries.push(entry);

    if (seen.has(key)) {
      if (!duplicates.includes(key)) duplicates.push(key);
    }
    seen.add(key);
    map.set(key, value);
  }

  return { entries, map, duplicates };
}

interface ValueRead {
  value: string;
  /** How many *additional* lines were consumed (for multiline quoted values). */
  consumedLines: number;
}

function readValue(rest: string, allLines: string[], startIndex: number): ValueRead {
  const leading = rest.replace(/^[ \t]+/, "");
  const quote = leading[0];

  if (quote === '"' || quote === "'" || quote === "`") {
    return readQuoted(leading, quote, allLines, startIndex);
  }

  // Unquoted: strip an inline comment, then trim surrounding whitespace.
  const withoutComment = stripInlineComment(rest);
  return { value: withoutComment.trim(), consumedLines: 0 };
}

function readQuoted(
  leading: string,
  quote: string,
  allLines: string[],
  startIndex: number,
): ValueRead {
  // Try to close on the same line first.
  const sameLine = closeOnLine(leading.slice(1), quote);
  if (sameLine !== null) {
    return { value: expand(sameLine, quote), consumedLines: 0 };
  }

  // Multiline: accumulate until we find the closing quote.
  let buffer = leading.slice(1);
  let consumed = 0;
  for (let j = startIndex + 1; j < allLines.length; j++) {
    consumed++;
    const line = allLines[j] ?? "";
    const closed = closeOnLine(line, quote);
    if (closed !== null) {
      buffer += "\n" + closed;
      return { value: expand(buffer, quote), consumedLines: consumed };
    }
    buffer += "\n" + line;
  }

  // Unterminated quote: return what we have (lenient, like most loaders).
  return { value: expand(buffer, quote), consumedLines: consumed };
}

/**
 * If the closing quote appears on this fragment, return the content before it;
 * otherwise return null. A quote escaped with a backslash does not close.
 */
function closeOnLine(fragment: string, quote: string): string | null {
  for (let k = 0; k < fragment.length; k++) {
    const ch = fragment[k];
    if (ch === "\\" && quote === '"') {
      k++; // Skip escaped char in double quotes.
      continue;
    }
    if (ch === quote) return fragment.slice(0, k);
  }
  return null;
}

/** Apply escape expansion for double-quoted values (dotenv behavior). */
function expand(value: string, quote: string): string {
  if (quote !== '"') return value;
  return value
    .replace(/\\n/g, "\n")
    .replace(/\\r/g, "\r")
    .replace(/\\t/g, "\t")
    .replace(/\\"/g, '"')
    .replace(/\\\\/g, "\\");
}

/**
 * Remove an inline `# comment` from an unquoted value.
 *
 * Matches dotenv's behavior: in an unquoted value, the first `#` begins a
 * comment and everything from it onward is dropped (so `FOO=bar#x` → `bar`,
 * `URL=http://x#frag` → `http://x`). A `#` inside a quoted value never reaches
 * here, because quoted values are handled separately.
 */
function stripInlineComment(rest: string): string {
  const idx = rest.indexOf("#");
  return idx === -1 ? rest : rest.slice(0, idx);
}
