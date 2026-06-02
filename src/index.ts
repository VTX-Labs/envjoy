/**
 * @vtx-labs/envjoy — programmatic API.
 *
 * Keep your `.env` in sync with `.env.example`. The library half is pure and
 * dependency-free; the CLI (the `envjoy` bin) wraps it with file I/O and a
 * colorized report.
 *
 * @example
 * ```ts
 * import { diffEnv } from "@vtx-labs/envjoy";
 * import { readFileSync } from "node:fs";
 *
 * const result = diffEnv(
 *   readFileSync(".env.example", "utf8"),
 *   readFileSync(".env", "utf8"),
 * );
 * if (!result.inSync) console.error("Missing:", result.missing);
 * ```
 */

export { parseEnv } from "./parser.js";
export type { ParsedEntry, ParseResult } from "./parser.js";

export { diffEnv } from "./diff.js";
export type { EnvDiff, DiffOptions } from "./diff.js";

export { applyMissing, generateExample } from "./fix.js";
export type { ApplyMissingResult } from "./fix.js";
