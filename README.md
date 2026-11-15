# SkyLoupe

![SkyLoupe: Annotate. Tune. Ship with Codex.](docs/assets/skyloupe-poster-wide.png)

Annotate a live React page, preview the tokens, and hand Codex a source location instead of a guessed selector.

[中文说明](docs/zh-CN.md)

Install the CLI from GitHub. npm is not required for the SkyLoupe packages themselves.

```bash
npm i github:pollackcarlos21-create/skyloupe#dist
```

Individual tarballs and the JSR steps are in [docs/RELEASING.md](docs/RELEASING.md).

```bash
pnpm install
pnpm --filter skyloupe build
pnpm exec skyloupe demo
```

`pnpm exec skyloupe demo --offline` replays the recorded edit and HMR loop with no Codex CLI and no network, then exits.

## What it is

| Package | Role |
| --- | --- |
| `@skyloupe/core` | Types, preview rollback, and canvas hit-test guard. No runtime dependencies. |
| `@skyloupe/react` | `AnnotationContainer`, `Annotatable`, `useAnnotationControls`, `AnnotatableCanvas`. |
| `@skyloupe/vite` | Dev-only `data-skyloupe-source` and `.skyloupe/session.json` injection. |
| `@skyloupe/devtools` | Polyfill and shadow-DOM capsule when the native API is absent. |
| `skyloupe` | `init`, `bridge`, `mcp`, `doctor`, `demo`. |

`@skyloupe/core` stays under 2 KB gzip. Core plus the React production entry stay under 4 KB gzip.

## Compared with agentation

This is the comparison from the project plan, not a review of agentation's current source.

|  | SkyLoupe | agentation |
| --- | --- | --- |
| License | MIT | PolyForm |
| `document.oai.annotation` | The supported surface | Not the target API |
| `registerControls` | Live token sliders with preview and rollback | No |
| `registerSurface` | Canvas objects such as the Q3 bar | No |
| Codex | `codex app-server` on `127.0.0.1`, or copy the Markdown bundle | No local bridge |

## Commands

```bash
pnpm exec skyloupe init
pnpm exec skyloupe bridge
pnpm exec skyloupe mcp
pnpm exec skyloupe doctor ./src
pnpm exec skyloupe demo
pnpm exec skyloupe demo --offline
```

`init` detects Vite, Next.js, or webpack and the package manager, installs the matching packages from the GitHub tarballs, adds `skyloupe:bridge`, and patches a Vite config when its `plugins` array is a literal. Otherwise it prints the diff. `bridge` listens on `127.0.0.1` only, checks `Host` and `Origin`, and requires the pairing token in `X-SkyLoupe-Token`.

## Develop this repo

Node 20 or newer. pnpm 10.33.4.

```bash
pnpm lint
pnpm typecheck
pnpm test
pnpm build
pnpm check:size
```

The spec table is [docs/spec-compliance.md](docs/spec-compliance.md). Choices the plan does not spell out are in [docs/decisions.md](docs/decisions.md).
