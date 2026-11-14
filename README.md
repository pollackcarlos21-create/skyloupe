# SkyLoupe

OpenAI Browser Annotations toolkit. Write once for `document.oai.annotation`, preview tokens in any browser, and ship live UI diffs to Codex.

Command: `skyloupe`. Library scope: `@skyloupe/*`.

This repository is at milestone M0: the pnpm workspace, TypeScript, tsup, vitest, the gzip gate, and CI. Later milestones add the spec layer, React bindings, the devtools simulator, and the Codex bridge.

## Packages

| Package | Role |
| --- | --- |
| `@skyloupe/core` | Zero-dependency core. Gzip must stay under 2 KB. |
| `@skyloupe/react` | React 18+ adapter (`react` is a peer dependency). |
| `@skyloupe/vite` | Dev-only Vite plugin (`vite` `>=5` is a peer dependency). |
| `@skyloupe/devtools` | Dev-only polyfill and overlay. |
| `skyloupe` | CLI. Binary name: `skyloupe`. |

`@skyloupe/core` and `@skyloupe/react` have no runtime third-party dependencies. Their combined gzip size must stay under 4 KB.

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

`pnpm check:size` reads `packages/core/dist/index.js` and `packages/react/dist/index.js`. Run `pnpm build` first.

The full plan is `PLAN.md`. Choices it does not cover are in `docs/decisions.md`.
