/**
 * Minimal, dependency-free ANSI styling.
 *
 * Respects `NO_COLOR` (https://no-color.org), `FORCE_COLOR`, and whether stdout
 * is a TTY. Keeping this in-house is part of staying bloat-free.
 */

const ESC = `${String.fromCharCode(27)}[`;

function colorEnabled(): boolean {
  if (process.env.NO_COLOR !== undefined && process.env.NO_COLOR !== "") return false;
  if (process.env.FORCE_COLOR !== undefined && process.env.FORCE_COLOR !== "0") return true;
  return Boolean(process.stdout && process.stdout.isTTY);
}

const ENABLED = colorEnabled();

function wrap(open: number, close: number) {
  return (s: string): string => (ENABLED ? `${ESC}${open}m${s}${ESC}${close}m` : s);
}

export const c = {
  enabled: ENABLED,
  bold: wrap(1, 22),
  dim: wrap(2, 22),
  red: wrap(31, 39),
  green: wrap(32, 39),
  yellow: wrap(33, 39),
  blue: wrap(34, 39),
  cyan: wrap(36, 39),
};
