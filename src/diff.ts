/**
 * The core comparison: given an example file (the source of truth that teams
 * commit) and an actual env file, determine what's out of sync.
 */

import { parseEnv } from "./parser.js";

export interface EnvDiff {
  /** Keys defined in the example but absent from the actual env file. */
  missing: string[];
  /** Keys present in the actual env file but not declared in the example. */
  extra: string[];
  /** Keys present in both but whose value is empty in the actual env file. */
  empty: string[];
  /** Keys present and non-empty in both — i.e. correctly configured. */
  ok: string[];
  /** Keys declared more than once in either file. */
  duplicates: { example: string[]; actual: string[] };
  /** True when there is no missing/extra/empty drift. */
  inSync: boolean;
}

export interface DiffOptions {
  /**
   * Treat extra keys (present in env, absent from example) as drift.
   * Default true. Set false to ignore extras (some teams keep local-only keys).
   */
  checkExtra?: boolean;
  /**
   * Treat empty values in the actual env as drift. Default true.
   */
  checkEmpty?: boolean;
  /**
   * Keys to ignore entirely (e.g. injected by the platform). Exact matches.
   */
  ignore?: readonly string[];
}

/**
 * Compare the raw contents of an example file against an actual env file.
 */
export function diffEnv(
  exampleContent: string,
  actualContent: string,
  options: DiffOptions = {},
): EnvDiff {
  const { checkExtra = true, checkEmpty = true, ignore = [] } = options;
  const ignoreSet = new Set(ignore);

  const example = parseEnv(exampleContent);
  const actual = parseEnv(actualContent);

  const missing: string[] = [];
  const extra: string[] = [];
  const empty: string[] = [];
  const ok: string[] = [];

  for (const key of example.map.keys()) {
    if (ignoreSet.has(key)) continue;
    if (!actual.map.has(key)) {
      missing.push(key);
    } else if (checkEmpty && (actual.map.get(key) ?? "").length === 0) {
      empty.push(key);
    } else {
      ok.push(key);
    }
  }

  if (checkExtra) {
    for (const key of actual.map.keys()) {
      if (ignoreSet.has(key)) continue;
      if (!example.map.has(key)) extra.push(key);
    }
  }

  const inSync = missing.length === 0 && empty.length === 0 && extra.length === 0;

  return {
    missing,
    extra,
    empty,
    ok,
    duplicates: { example: example.duplicates, actual: actual.duplicates },
    inSync,
  };
}
