---
name: skyloupe
description: Add OpenAI browser annotations to a React page, or turn a SkyLoupe annotation bundle into a scoped source edit.
---

# SkyLoupe

Use this when the user wants a page to work with `document.oai.annotation`, or when they paste a SkyLoupe annotation bundle / the Markdown prompt from the devtools copy button.

## Add annotations

1. Wrap the page section in `AnnotationContainer` from `@skyloupe/react`.
2. Mark the target with `Annotatable`. Keep `metadata` flat: at most 6 keys, values only string, finite number, boolean, or null.
3. Bind design tokens with `useAnnotationControls`. Put `cssVar` and `unit` on the React config for preview. Do not pass those fields to `registerControls`; the hook removes them.
4. For a canvas chart, use `AnnotatableCanvas` and `virtualObjects` with canvas-space `rect`s. Handle `onControlChange` by `virtualTarget.targetId` from the event, not by whichever bar is hovered later.
5. In a Vite app, add `@skyloupe/vite` so dev builds get `data-skyloupe-source`. Mount `mountDevtools()` from `@skyloupe/devtools` only when `import.meta.env.DEV` is true.
6. Do not add a second copy of the 18 official rules. Runtime checks belong to `@skyloupe/core/validators`, and only in development.

## Apply an annotation bundle

1. Read `### Target` for the source location and metadata.
2. Read the control table. For a select control, the requested value is the visible option label; the preview value may be the option value.
3. Change the component or token named in the table. Remove temporary inline preview styles.
4. Keep the edit inside that component. Run the project's typecheck.
5. If the page is the SkyLoupe demo, the recorded offline edit sets Pro radius to `20` and accent to `#0f766e` in `demo/app/src/components/PricingCard.tsx`.

## Do not

- Publish the package, open a release, or post the launch notes. Those stay with the maintainer.
- Point the bridge at `0.0.0.0` or send `sandboxPolicy.type: "dangerFullAccess"`.
- Treat the two planted demo issues (`Legacy note` nested metadata, `Launch badge` outside a container) as product bugs.
