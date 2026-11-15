# M5 checklist for Ray

The cloud agent does not publish, tag, or post. Section 11.2 of `PLAN.md` stays your call.

## ChatGPT desktop built-in browser

Only the ChatGPT desktop app can show the native `document.oai.annotation` controls. Run this after `pnpm --filter skyloupe-demo dev` or `pnpm exec skyloupe demo`.

1. Open the printed `http://127.0.0.1:5173/` URL in the ChatGPT desktop built-in browser, not in Chrome.
2. In the page console, confirm `document.oai.annotation` already exists before SkyLoupe mounts. The capsule should say `Native browser`, and SkyLoupe must not replace the native methods.
3. Turn on the native annotate control. Select the Pro card. Move padding, radius, and accent. The card should follow the native preview.
4. Select the Q3 Revenue bar on the canvas. The highlight should be that bar alone, not the whole canvas.
5. Open the diagnostics drawer with Alt+Shift+D. It should list exactly two planted issues: `OAI-META-001` on Legacy note and `OAI-DOM-001` on Launch badge.
6. Compare the same URL in ordinary Chrome, where SkyLoupe installs the polyfill and shows `Clipboard Mode` until `skyloupe bridge` is paired.

## Offline replay

`pnpm exec skyloupe demo --offline` must finish without a Codex binary and without leaving `demo/app/src/components/PricingCard.tsx` modified. The log ends with `Replay complete. No Codex CLI and no network.`

## Not done here

- npm publish
- GitHub releases or tags
- The Hacker News and example-PR notes in PLAN.md section 11.2
