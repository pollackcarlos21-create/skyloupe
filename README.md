# SkyLoupe

SkyLoupe is a framework-agnostic inspection toolkit. The command-line binary is `skyloupe`. Packages are published under the `@skyloupe/*` scope.

This repository is at milestone M0: a pnpm workspace, TypeScript, tsup builds, vitest, a gzip size gate, and GitHub Actions. Product behavior starts in a later milestone.

## Packages

| Package | Role |
| --- | --- |
| `@skyloupe/schema` | Config contract |
| `@skyloupe/core` | Framework-agnostic core. No runtime third-party dependencies. |
| `@skyloupe/dom` | DOM adapter |
| `@skyloupe/react` | React adapter. `react` is a peer dependency. |
| `@skyloupe/cli` | CLI. Binary name: `skyloupe`. |

## Requirements

- Node.js 20 or newer (CI uses 22)
- pnpm 10.33.4 (`corepack enable && corepack prepare pnpm@10.33.4 --activate`)

## Scripts

```bash
pnpm install
pnpm lint
pnpm typecheck
pnpm test
pnpm build
pnpm check:size
```

`pnpm check:size` reads each package's built `dist/index.js` and compares gzip size to `scripts/size-budget.json`. Run `pnpm build` first.

## Layout

```
packages/{schema,core,dom,react,cli}
scripts/check-size.mjs
scripts/size-budget.json
.github/workflows/ci.yml
docs/decisions.md
```

Choices that were not fixed by an available plan are listed in `docs/decisions.md`.
