# Decisions

Unspecified details use the simplest reversible option. One line each.

- 2026-11-14: Uploaded plan `/workspace/uploads/PLAN_7c35.md` was not on disk, so section 4.1, 4.2, and 8 could not be copied verbatim.
- 2026-11-14: Five packages are `@skyloupe/schema`, `@skyloupe/core`, `@skyloupe/dom`, `@skyloupe/react`, and `@skyloupe/cli` (bin `skyloupe`), in `packages/<short-name>`.
- 2026-11-14: Tooling is pnpm 10.33.4, TypeScript 5.9, tsup 8, vitest 3, ESLint 9 flat config, Node `>=20` (CI runs Node 22).
- 2026-11-14: Packages are ESM-only, target ES2022, tsup emits minified `dist/index.js` plus `.d.ts`, and public `exports` point at `dist`.
- 2026-11-14: `pnpm typecheck` and vitest resolve workspace packages to TypeScript source (`paths` / vitest alias) so they do not need a prior build.
- 2026-11-14: Lint is ESLint recommended plus typescript-eslint recommended; no extra rule set and no formatter in M0.
- 2026-11-14: Gzip budgets in `scripts/size-budget.json` are provisional: schema, core, dom, and react 2048 bytes; cli 4096 bytes; measured on `dist/index.js`.
- 2026-11-14: M0 stubs export a version (and the CLI prints `skyloupe` / `--version`); no product behavior from later milestones.
- 2026-11-14: Packages stay `private` at `0.0.0` with no license file until a publish milestone.
- 2026-11-14: `@skyloupe/react` depends on `@skyloupe/core` via `workspace:*`; `react` `>=18` is only a peerDependency, with `react` and `@types/react` as devDependencies.
- 2026-11-14: No runtime third-party dependencies in any M0 package; schema does not take a validator library yet.
- 2026-11-14: `pnpm check:size` does not build; CI and local use run `pnpm build` before it.
- 2026-11-14: pnpm 10 blocks dependency lifecycle scripts, so `pnpm.onlyBuiltDependencies` allows `esbuild` (required by tsup).
