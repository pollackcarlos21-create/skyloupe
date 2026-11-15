# Releasing SkyLoupe 0.2.0

Ray publishes. This repo does not run `npm publish` or `npx jsr publish` for you.

npm is not the primary channel. The packages are still npm-ready (`files`, `exports`, `types`, `license`, `repository`, `prepublishOnly`). Install from the `dist` branch or from JSR.

## Install without publishing to npm

After a push to `main`, GitHub Actions builds the packages and updates the `dist` branch.

The CLI and its libraries:

```bash
npm i github:pollackcarlos21-create/skyloupe#dist
npx skyloupe --version
```

One package, from the tarball on that same branch:

```bash
npm i https://raw.githubusercontent.com/pollackcarlos21-create/skyloupe/dist/packs/skyloupe-core-0.2.0.tgz
npm i https://raw.githubusercontent.com/pollackcarlos21-create/skyloupe/dist/packs/skyloupe-react-0.2.0.tgz
npm i https://raw.githubusercontent.com/pollackcarlos21-create/skyloupe/dist/packs/skyloupe-vite-0.2.0.tgz
npm i https://raw.githubusercontent.com/pollackcarlos21-create/skyloupe/dist/packs/skyloupe-devtools-0.2.0.tgz
npm i https://raw.githubusercontent.com/pollackcarlos21-create/skyloupe/dist/packs/skyloupe-0.2.0.tgz
npm i https://raw.githubusercontent.com/pollackcarlos21-create/skyloupe/dist/packs/skyloupe-webpack-0.2.0.tgz
npm i https://raw.githubusercontent.com/pollackcarlos21-create/skyloupe/dist/packs/skyloupe-next-0.2.0.tgz
```

The library tarballs depend on the core tarball at that raw URL, not on the npm registry. Third-party packages such as `react` and `commander` still come from npm.

Rebuild the branch locally without pushing:

```bash
pnpm build
node scripts/publish-dist.mjs --out /tmp/skyloupe-dist
```

## JSR

Each publishable package has a `jsr.json`. The scope is `@pollackcarlos21-create`, which matches the GitHub account that owns this repo. Sign in to [jsr.io](https://jsr.io) with that GitHub login and create the scope if it does not exist yet. If JSR shows a different username, change the `name` in every `jsr.json` before publishing.

Publish in this order, from the package directory. Do this yourself:

```bash
cd packages/core && npx jsr publish
cd packages/react && npx jsr publish
cd packages/vite && npx jsr publish
cd packages/devtools && npx jsr publish
cd packages/webpack && npx jsr publish
cd packages/next && npx jsr publish
cd packages/cli && npx jsr publish
```

`npx jsr publish` asks you to confirm the version. Do not add `--allow-dirty` unless you mean to publish uncommitted files.

Install from JSR after that:

```bash
npx jsr add @pollackcarlos21-create/core
npx jsr add @pollackcarlos21-create/react
npx jsr add @pollackcarlos21-create/vite
npx jsr add @pollackcarlos21-create/devtools
npx jsr add @pollackcarlos21-create/skyloupe
```

## npm, only if the account restriction is lifted

From each package directory, after `pnpm build` (also run automatically by `prepublishOnly`):

```bash
cd packages/core && npm publish --access public
cd packages/react && npm publish --access public
cd packages/vite && npm publish --access public
cd packages/devtools && npm publish --access public
cd packages/cli && npm publish --access public
```

Publish `@skyloupe/core` first. The other packages depend on it.

## Playground

The static playground is `playground/`. Actions deploys it to GitHub Pages when Pages is set to GitHub Actions. Enable that in the repository settings. The site base path is `/skyloupe/`.
