#!/usr/bin/env node
/**
 * envjoy CLI — keep your .env in sync with .env.example.
 *
 * Exit codes:
 *   0  in sync (or a non-check command succeeded)
 *   1  drift detected in --check mode
 *   2  usage / file-not-found / unexpected error
 */

import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { banner } from "./banner.js";
import { c } from "./colors.js";
import { diffEnv } from "./diff.js";
import { applyMissing, generateExample } from "./fix.js";

const VERSION = "0.1.0";

interface Flags {
  env: string;
  example: string;
  fix: boolean;
  check: boolean;
  generate: boolean;
  force: boolean;
  noExtra: boolean;
  noEmpty: boolean;
  ignore: string[];
  help: boolean;
  version: boolean;
}

function parseArgs(argv: string[]): Flags {
  const f: Flags = {
    env: ".env",
    example: ".env.example",
    fix: false,
    check: false,
    generate: false,
    force: false,
    noExtra: false,
    noEmpty: false,
    ignore: [],
    help: false,
    version: false,
  };

  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    switch (a) {
      case "-h":
      case "--help":
        f.help = true;
        break;
      case "-v":
      case "--version":
        f.version = true;
        break;
      case "--fix":
        f.fix = true;
        break;
      case "--check":
      case "--ci":
        f.check = true;
        break;
      case "--generate":
        f.generate = true;
        break;
      case "--force":
      case "-f":
        f.force = true;
        break;
      case "--no-extra":
        f.noExtra = true;
        break;
      case "--no-empty":
        f.noEmpty = true;
        break;
      case "-e":
      case "--env":
        f.env = requireValue(argv, ++i, a);
        break;
      case "-x":
      case "--example":
        f.example = requireValue(argv, ++i, a);
        break;
      case "--ignore":
        f.ignore.push(...requireValue(argv, ++i, a).split(",").map((s) => s.trim()).filter(Boolean));
        break;
      default:
        if (a !== undefined && a.startsWith("-")) fail(`Unknown option: ${a}\nRun \`envjoy --help\` for usage.`);
        else if (a !== undefined) fail(`Unexpected argument: ${a}\nRun \`envjoy --help\` for usage.`);
    }
  }
  return f;
}

function requireValue(argv: string[], i: number, flag: string): string {
  const v = argv[i];
  if (v === undefined || v.startsWith("-")) fail(`Option ${flag} expects a value.`);
  return v as string;
}

function fail(msg: string): never {
  process.stderr.write(`${c.red("error")} ${msg}\n`);
  process.exit(2);
}

function help(): void {
  const b = c.bold;
  process.stdout.write(`
${banner("envjoy · keep your .env in sync with .env.example")}
${b("envjoy")} ${c.dim("v" + VERSION)} — keep your .env in sync with .env.example

${b("Usage")}
  envjoy [options]

${b("Options")}
  -e, --env <file>       Env file to check        ${c.dim("(default: .env)")}
  -x, --example <file>   Example/source of truth  ${c.dim("(default: .env.example)")}
      --fix              Append missing keys to the env file (placeholders)
      --check, --ci      Exit non-zero on drift; no changes ${c.dim("(for CI)")}
      --generate         Write <example> from <env>, with values stripped
  -f, --force            Allow --generate to overwrite an existing example
      --no-extra         Ignore keys present in env but not in example
      --no-empty         Ignore empty values in env
      --ignore <keys>    Comma-separated keys to ignore (e.g. NODE_ENV,PORT)
  -h, --help             Show this help
  -v, --version          Show version

${b("Examples")}
  envjoy                         ${c.dim("# report drift between .env and .env.example")}
  envjoy --check                 ${c.dim("# fail CI if .env is out of sync")}
  envjoy --fix                   ${c.dim("# scaffold missing keys into .env")}
  envjoy --generate              ${c.dim("# create .env.example from .env")}
  envjoy -e .env.production -x .env.example

${c.dim("Built by VTX Labs · https://vtxlabs.dev")}
`);
}

function readOptional(path: string): string | null {
  const abs = resolve(process.cwd(), path);
  if (!existsSync(abs)) return null;
  try {
    return readFileSync(abs, "utf8");
  } catch (err) {
    fail(`Could not read ${path}: ${(err as Error).message}`);
  }
}

function main(): void {
  const flags = parseArgs(process.argv.slice(2));

  if (flags.help) return help();
  if (flags.version) {
    process.stdout.write(VERSION + "\n");
    return;
  }

  // Guard against conflicting/destructive flag combinations up front.
  if (flags.fix && flags.check) {
    fail("--fix and --check are mutually exclusive (one writes, one is read-only).");
  }
  if (resolve(process.cwd(), flags.env) === resolve(process.cwd(), flags.example)) {
    fail(`--env and --example point at the same file (${flags.env}).`);
  }

  // --generate: build the example from the env file and exit.
  if (flags.generate) {
    const envContent = readOptional(flags.env);
    if (envContent === null) fail(`Env file not found: ${flags.env}`);
    const target = resolve(process.cwd(), flags.example);
    if (existsSync(target) && !flags.force) {
      fail(`${flags.example} already exists. Re-run with --force to overwrite it.`);
    }
    writeFileSync(target, generateExample(envContent), "utf8");
    process.stdout.write(`${c.green("created")} ${flags.example} from ${flags.env}\n`);
    return;
  }

  const exampleContent = readOptional(flags.example);
  if (exampleContent === null) {
    fail(
      `Example file not found: ${flags.example}\n` +
        `Create one, or generate it from your env with: envjoy --generate`,
    );
  }
  // Read the env file exactly once (avoids a TOCTOU double-read).
  const rawEnv = readOptional(flags.env);
  const envExists = rawEnv !== null;
  const actualContent = rawEnv ?? "";

  const diff = diffEnv(exampleContent as string, actualContent, {
    checkExtra: !flags.noExtra,
    checkEmpty: !flags.noEmpty,
    ignore: flags.ignore,
  });

  // --fix: write missing keys, then report.
  if (flags.fix) {
    const { content, added } = applyMissing(exampleContent as string, actualContent);
    if (added.length > 0) {
      writeFileSync(resolve(process.cwd(), flags.env), content, "utf8");
      process.stdout.write(
        `${c.green("fixed")} added ${added.length} key${added.length === 1 ? "" : "s"} to ${flags.env}: ${added
          .map((k) => c.cyan(k))
          .join(", ")}\n`,
      );
    } else {
      process.stdout.write(`${c.green("ok")} no missing keys to add\n`);
    }
    return;
  }

  report(diff, flags, envExists);

  // In --check, duplicate keys are also drift (a duplicated key is a real bug).
  const hasDuplicates =
    diff.duplicates.example.length > 0 || diff.duplicates.actual.length > 0;
  if (flags.check && (!diff.inSync || hasDuplicates)) process.exit(1);
}

function report(
  diff: ReturnType<typeof diffEnv>,
  flags: Flags,
  envExists: boolean,
): void {
  const out = process.stdout;
  const line = (s = "") => out.write(s + "\n");

  // Show the brand banner only for interactive runs, so CI/piped output stays clean.
  if (out.isTTY && !flags.check) line(banner());

  if (!envExists) {
    line(`${c.yellow("!")} ${flags.env} does not exist — comparing against an empty file.`);
    line(`  ${c.dim(`Run \`envjoy --fix\` to scaffold it from ${flags.example}.`)}`);
    line();
  }

  if (diff.inSync && diff.duplicates.example.length === 0 && diff.duplicates.actual.length === 0) {
    line(`${c.green("✓")} ${c.bold(flags.env)} is in sync with ${c.bold(flags.example)} ${c.dim(`(${diff.ok.length} keys)`)}`);
    return;
  }

  if (diff.missing.length > 0) {
    line(`${c.red("✗")} ${c.bold(`Missing ${diff.missing.length}`)} ${c.dim("(in example, not in env)")}`);
    for (const k of diff.missing) line(`    ${c.red("-")} ${k}`);
    line();
  }
  if (diff.empty.length > 0) {
    line(`${c.yellow("●")} ${c.bold(`Empty ${diff.empty.length}`)} ${c.dim("(present but no value)")}`);
    for (const k of diff.empty) line(`    ${c.yellow("○")} ${k}`);
    line();
  }
  if (diff.extra.length > 0) {
    line(`${c.blue("+")} ${c.bold(`Extra ${diff.extra.length}`)} ${c.dim("(in env, not in example)")}`);
    for (const k of diff.extra) line(`    ${c.blue("+")} ${k}`);
    line();
  }
  if (diff.duplicates.example.length > 0)
    line(`${c.yellow("!")} duplicate keys in ${flags.example}: ${diff.duplicates.example.join(", ")}`);
  if (diff.duplicates.actual.length > 0)
    line(`${c.yellow("!")} duplicate keys in ${flags.env}: ${diff.duplicates.actual.join(", ")}`);

  const total = diff.missing.length + diff.empty.length + diff.extra.length;
  if (total > 0) {
    line(
      c.dim(
        `${diff.ok.length} ok · run \`envjoy --fix\` to add missing keys` +
          (flags.check ? "" : " · `--check` for CI"),
      ),
    );
  }
}

try {
  main();
} catch (err) {
  fail((err as Error).message ?? String(err));
}
