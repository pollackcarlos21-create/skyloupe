# M4 local checklist

This loop needs your machine, a logged-in Codex CLI, and a Vite app. The cloud agent verified the wire protocol and the bridge's 403 checks, not a live code edit.

## Before you start

1. Install Codex and sign in: `npm i -g @openai/codex` then `codex login`.
2. Confirm `codex --version` and that `codex app-server` starts.
3. From this repo: `pnpm install` and `pnpm --filter skyloupe build`.
4. In a Vite app, add `@skyloupe/vite` to `vite.config` and call `mountDevtools()` from `@skyloupe/devtools` while `import.meta.env.DEV` is true.
5. Put a control on a card whose `reference` is a CSS variable, for example `--card-padding`.

## Bridge

1. In the app repo, run `pnpm exec skyloupe bridge` (or `node /path/to/skyloupe/dist/cli.js bridge`).
2. Expect:
   - `SkyLoupe local bridge listening on http://127.0.0.1:4777`
   - `Pairing token written to .skyloupe/session.json`
   - `Connected to codex app-server` with `sandbox: workspaceWrite`
3. Confirm `.skyloupe/session.json` is mode `0600` and contains `port` and a 64-character hex `token`.
4. Restart the Vite dev server so the plugin injects that session.

## Annotation

1. Open the Vite origin (`http://localhost:<dev-port>` or `http://127.0.0.1:<dev-port>`).
2. The capsule should switch from `Clipboard Mode` to `Codex Connected`.
3. Turn on Annotate, pick the card, and drag the padding slider. The CSS variable should change immediately.
4. Hold **Hold to compare** and confirm the original value returns until you release.
5. Write a comment and click **Send to Codex**.

## What the bridge must do

1. Reject a POST from `Origin: https://evil.example`, a non-loopback `Host`, or a missing/wrong `X-SkyLoupe-Token` with `403`.
2. Save the screenshot under the system temp `skyloupe` directory as mode `0600`.
3. Send `turn/start` with `input` containing `{ "type": "text" }` and `{ "type": "localImage", "path": "<that png>" }`.
4. Send `sandboxPolicy` as `{ "type": "workspaceWrite", "writableRoots": ["<repo root>"], "networkAccess": false }`. The wire must not contain `"jsonrpc": "2.0"` or `dangerFullAccess`.
5. Stream progress in the capsule. When `turn/completed` has `status: "completed"`, the preview inline style resets so HMR can show the edited source.

## If Codex asks for approval

`thread/start` uses `approvalPolicy: "never"`. If your Codex config still prompts, accept the file change in the Codex UI, or set approvals to never for this workspace. Do not switch the bridge to `dangerFullAccess`.
