# Decisions

- 2026-11-14: Root package is named `skyloupe-workspace` so it does not collide with the `skyloupe` CLI package.
- 2026-11-14: `pnpm lint` uses ESLint 9 flat config with typescript-eslint recommended; PLAN.md does not name a linter.
- 2026-11-14: TypeScript target is ES2022 with `moduleResolution: Bundler`; PLAN.md specifies TypeScript 5 strict and ESM but not the target.
- 2026-11-14: tsup emits minified ESM plus `.d.ts` so `check-size` measures a production-like gzip.
- 2026-11-14: Combined gzip is the sum of each package's gzip size, matching M2's "合计".
- 2026-11-14: `check-size` rejects `window` or `document` in the core and react bundles except `typeof window` and `typeof document`, using a text scan.
- 2026-11-14: Section 4.2 modules other than each package entry export only a `skyloupeModule` id until the milestone that implements them.
- 2026-11-14: `demo/`, `skills/`, and `docs/spec-compliance.md` wait for M5; M0 creates the workspace and the five packages.
- 2026-11-14: Each package has `tsconfig.json` and `tsup.config.ts`, which section 4.2 does not draw but tsup and `tsc` need.
- 2026-11-14: `pnpm typecheck` and vitest resolve `@skyloupe/core` to TypeScript source; published `exports` point at `dist`.
- 2026-11-14: Packages stay `private` at `0.0.0` until the v0.1 publish in M4.
- 2026-11-14: CI uses Node 22 and pnpm 10.33.4; PLAN.md requires Node 20+ and pnpm without a pin.
- 2026-11-14: pnpm 10 runs install scripts only for `esbuild` via `pnpm.onlyBuiltDependencies`.
- 2026-11-14: `@skyloupe/devtools` does not declare a React peer in M0; section 4.1 specifies custom elements and does not list one.
- 2026-11-14: `@skyloupe/vite` devDependency is the current Vite 8; the peer range stays `>=5.0.0` as section 4.1 specifies.
