```
███████╗███╗   ██╗██╗   ██╗     ██╗ ██████╗ ██╗   ██╗
██╔════╝████╗  ██║██║   ██║     ██║██╔═══██╗╚██╗ ██╔╝
█████╗  ██╔██╗ ██║██║   ██║     ██║██║   ██║ ╚████╔╝ 
██╔══╝  ██║╚██╗██║╚██╗ ██╔╝██   ██║██║   ██║  ╚██╔╝  
███████╗██║ ╚████║ ╚████╔╝ ╚█████╔╝╚██████╔╝   ██║   
╚══════╝╚═╝  ╚═══╝  ╚═══╝   ╚════╝  ╚═════╝    ╚═╝   
```

# envjoy

**Keep your `.env` in sync with `.env.example`.**

[![npm](https://img.shields.io/npm/v/@vtx-labs/envjoy?color=3182ce)](https://www.npmjs.com/package/@vtx-labs/envjoy)
[![CI](https://github.com/VTX-Labs/envjoy/actions/workflows/ci.yml/badge.svg)](https://github.com/VTX-Labs/envjoy/actions)
[![License: MIT](https://img.shields.io/badge/License-MIT-3182ce.svg)](LICENSE)
[![Zero dependencies](https://img.shields.io/badge/dependencies-0-3182ce)](package.json)

---

Add a key to `.env`, forget to update `.env.example`, and your teammate's app
breaks on boot. **envjoy** compares the two files you already keep and tells you
exactly what drifted — missing, empty, or extra keys. No schema, no config, no
accounts.

```console
$ npx @vtx-labs/envjoy

✗ Missing 2 (in example, not in env)
    - STRIPE_SECRET_KEY
    - REDIS_URL
● Empty 1 (present but no value)
    ○ DATABASE_URL
+ Extra 1 (in env, not in example)
    + DEBUG_FLAG

4 ok · run `envjoy --fix` to add missing keys · `--check` for CI
```

## Quick start

```bash
npx @vtx-labs/envjoy            # report drift (no install)
envjoy --fix                    # scaffold missing keys into .env
envjoy --check                  # exit non-zero on drift (CI / pre-commit)
envjoy --generate               # create .env.example from .env, values stripped
```

Or add it to a project: `pnpm add -D @vtx-labs/envjoy`

## Why not dotenv / env-schema / dotenv-safe?

Those load variables or validate against a **schema you hand-write**. envjoy
validates against the `.env.example` your team **already maintains** — nothing
extra to keep in sync, and **zero runtime dependencies**.

## CLI

```
envjoy [options]

  -e, --env <file>       Env file to check        (default: .env)
  -x, --example <file>   Source of truth          (default: .env.example)
      --fix              Append missing keys to the env file (placeholders)
      --check, --ci      Exit non-zero on drift; makes no changes
      --generate         Write <example> from <env>, with values stripped
  -f, --force            Allow --generate to overwrite an existing example
      --no-extra         Ignore keys in env but not in example
      --no-empty         Ignore empty values in env
      --ignore <keys>    Comma-separated keys to skip (e.g. NODE_ENV,PORT)
  -h, --help             Show help
  -v, --version          Show version
```

| Exit code | Meaning                                              |
| :-------- | :--------------------------------------------------- |
| `0`       | In sync, or a non-`--check` command succeeded        |
| `1`       | Drift (or duplicate keys) detected in `--check` mode |
| `2`       | Usage error or a required file was not found         |

```yaml
# .github/workflows/ci.yml — fail the build if .env drifts
- run: npx @vtx-labs/envjoy --check --no-empty
```

## Programmatic API

The library half is pure and dependency-free.

```ts
import { diffEnv } from "@vtx-labs/envjoy";
import { readFileSync } from "node:fs";

const diff = diffEnv(
  readFileSync(".env.example", "utf8"),
  readFileSync(".env", "utf8"),
  { ignore: ["NODE_ENV"] },
);

if (!diff.inSync) console.error("Drift:", { ...diff });
```

| Export                               | Description                                         |
| :----------------------------------- | :-------------------------------------------------- |
| `diffEnv(example, actual, options?)` | Compare two env strings → `EnvDiff`                 |
| `applyMissing(example, actual)`      | Env content with missing keys appended              |
| `generateExample(actual)`            | Build an example (values stripped) from an env      |
| `parseEnv(content)`                  | dotenv-compatible parser → entries, map, duplicates |

## How it works

envjoy parses both files with a **dotenv-compatible parser** — `export`
prefixes, single/double/back-quoted and multiline values, `\n`/`\t` escapes,
inline and full-line `#` comments, CRLF, and a UTF-8 BOM — then does a set
comparison. Malformed lines are skipped, never fatal. `--fix` only ever _adds_
missing keys using the example's placeholders; it never copies real values.

## License

[MIT](LICENSE) © [VTX Labs](https://vtxlabs.dev)

<div align="center">
<sub>Built by <a href="https://vtxlabs.dev">VTX Labs</a> · <a href="https://github.com/VTX-Labs">GitHub</a> · <a href="https://x.com/vtxlabs">@vtxlabs</a></sub>
</div>
