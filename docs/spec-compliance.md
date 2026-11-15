# Spec compliance

SkyLoupe follows the 18 rules in `PLAN.md` section 5.2. The polyfill calls `@skyloupe/core/validators`. It does not keep a second copy of the rules.

| Rule | Behavior |
| --- | --- |
| `OAI-ENV-001` | Do not inject outside a secure top-level document. `registerSurface` in a frame throws. |
| `OAI-DOM-001` | An annotatable with no container ancestor is ignored. The drawer warns. |
| `OAI-DOM-002` | The nearest container wins. `oai-annotation-container-text` beats `oai-annotation-container` on the same element. |
| `OAI-META-001` | Nested objects, arrays, and a seventh key drop the whole metadata object. The drawer records an error. |
| `OAI-META-002` | Bad keys, long strings, and oversized JSON drop the metadata object. |
| `OAI-REQ-001` | `toggle` and `request` outside a user gesture return `{ accepted: false }`. |
| `OAI-REQ-002` | A bad target or `mode: "advanced"` on a `Range` returns `{ accepted: false }`. |
| `OAI-CTRL-001` | The 65th registration, the 1025th target link, or an empty initial target list throws. |
| `OAI-CTRL-002` | Extra fields, duplicate callbacks, more than 12 controls, or a huge payload throw. |
| `OAI-CTRL-003` | Control text with bidi or other forbidden characters throws. |
| `OAI-CTRL-004` | A callback or reference that fails the official pattern throws. A space in a reference is this rule. |
| `OAI-CTRL-005` | A range outside the official numeric bounds throws. The start value does not have to sit on the step. |
| `OAI-CTRL-006` | A non-hex color or a non-boolean toggle throws. Omitted values fall back to `#ffffff` and `false`. |
| `OAI-CTRL-007` | Select preview uses `option.value`. The recorded annotation uses `option.label`. |
| `OAI-CTRL-008` | `update` after `dispose` throws. A failed `update` keeps the previous registration. |
| `OAI-SURF-001` | A disconnected element, a non-element, or a shadow host throws. |
| `OAI-SURF-002` | One hit test at a time. After 250 ms the drawer warns `deadlock` and picking falls back to the DOM. |
| `OAI-MODE-001` | `isActive()` updates before `oaiannotationmodechange`. Space lets clicks through and leaves annotation mode on. |

Tests live in `packages/core/test/validators.test.ts` and `packages/devtools/test/polyfillSpec.test.ts`.
