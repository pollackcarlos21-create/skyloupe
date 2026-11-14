import { bridgeLamp, listenBridge, probeBridge, readBrowserSession, sendAnnotation } from "../client/bridgeClient";
import { buildAnnotationBundle, formatAnnotationMarkdown, withUnchangedChoices } from "../capture/bundleBuilder";
import { renderEditor, type EditorSession } from "./editorPanel";
import { renderDrawer, scanDiagnostics } from "./diagnosticsDrawer";
import { placeHighlight } from "./highlightLayer";
import { pickAt, type AnnotationPick } from "../polyfill/picker";
import { registrationFor } from "../polyfill/registry";
import type { DevtoolsMode } from "../polyfill/installPolyfill";

const CSS = `
:host { all: initial; }
.shell { position: fixed; inset: 0; pointer-events: none; z-index: 2147483646; font: 13px/1.4 ui-sans-serif, system-ui, sans-serif; color: #1c1917; }
.banner, .capsule, .editor, .drawer { pointer-events: auto; }
.banner { position: fixed; top: 12px; left: 50%; transform: translateX(-50%); background: #1c1917; color: #fafaf9; padding: 6px 12px; border-radius: 999px; }
.capsule { position: fixed; right: 16px; bottom: 16px; display: flex; gap: 6px; align-items: center; padding: 6px; background: #1c1917; color: #fafaf9; border-radius: 999px; box-shadow: 0 10px 30px rgba(28,25,23,.28); }
.capsule button, .editor button { border: 0; border-radius: 999px; padding: 6px 10px; font: inherit; cursor: pointer; }
.annotate { background: #fafaf9; color: #1c1917; }
.annotate[aria-pressed="true"] { background: #f59e0b; }
.badge { background: #166534; color: white; }
.badge[data-hot="true"] { background: #b91c1c; }
.bridge { background: transparent; color: #a8a29e; }
.bridge[data-connected="true"] { color: #86efac; }
.editor, .drawer { position: fixed; background: #fffdf8; border: 1px solid #e7e5e4; border-radius: 14px; box-shadow: 0 16px 40px rgba(28,25,23,.18); }
.editor { right: 16px; bottom: 72px; width: 280px; max-height: 70vh; overflow: auto; padding: 12px; display: grid; gap: 8px; }
.editor h2 { margin: 0; font-size: 15px; }
.editor .source, .drawer p { margin: 0; color: #57534e; }
.editor label { display: grid; gap: 4px; font-size: 12px; }
.editor input, .editor select, .editor textarea { width: 100%; font: inherit; }
.editor textarea { min-height: 56px; }
.editor .row { display: flex; gap: 8px; }
.drawer { left: 16px; bottom: 16px; width: min(360px, calc(100vw - 32px)); max-height: 48vh; overflow: auto; padding: 12px; display: grid; gap: 8px; }
.issue { border-left: 3px solid #b91c1c; padding: 6px 8px; background: #fef2f2; }
.issue.warn { border-left-color: #d97706; background: #fffbeb; }
.highlight { position: fixed; border: 2px solid #d97706; border-radius: 6px; box-shadow: 0 0 0 4px rgba(217,119,6,.18); pointer-events: none; }
`;

export function mountOverlay(mode: Exclude<DevtoolsMode, "native-passthrough">): void {
  if (document.querySelector("skyloupe-devtools-host")) return;
  if (!customElements.get("skyloupe-devtools-host")) {
    customElements.define("skyloupe-devtools-host", class extends HTMLElement {});
  }
  const host = document.createElement("skyloupe-devtools-host");
  host.style.cssText = "position:fixed;inset:0;z-index:2147483646;pointer-events:none;";
  const shadow = host.attachShadow({ mode: "open" });
  const style = document.createElement("style");
  style.textContent = CSS;
  const shell = document.createElement("div");
  shell.className = "shell";
  const banner = document.createElement("div");
  banner.className = "banner";
  banner.hidden = true;
  banner.textContent = "Annotation Mode · Hold Space to interact with page";
  const highlight = document.createElement("div");
  highlight.className = "highlight";
  highlight.hidden = true;
  const capsule = document.createElement("div");
  capsule.className = "capsule";
  const annotate = document.createElement("button");
  annotate.type = "button";
  annotate.className = "annotate";
  annotate.dataset.skyloupeRole = "annotate";
  annotate.textContent = "Annotate";
  const badge = document.createElement("button");
  badge.type = "button";
  badge.className = "badge";
  badge.dataset.skyloupeRole = "badge";
  const bridge = document.createElement("span");
  bridge.className = "bridge";
  bridge.dataset.skyloupeRole = "bridge";
  bridge.textContent = bridgeLamp(mode).label;
  bridge.dataset.connected = "false";
  if (mode === "polyfill-standalone") capsule.append(annotate);
  capsule.append(badge, bridge);
  const editor = document.createElement("section");
  editor.className = "editor";
  editor.dataset.skyloupeRole = "editor";
  editor.hidden = true;
  const drawer = document.createElement("section");
  drawer.className = "drawer";
  drawer.dataset.skyloupeRole = "drawer";
  drawer.hidden = true;
  shell.append(banner, highlight, capsule, editor, drawer);
  shadow.append(style, shell);
  document.body.append(host);

  const session: EditorSession = { changes: [], comment: "" };
  let space = false;
  let rendered: AnnotationPick | undefined;
  const paint = (rebuild: boolean) => {
    const active = mode === "polyfill-standalone" && document.oai?.annotation?.isActive() === true;
    banner.hidden = !active;
    annotate.setAttribute("aria-pressed", active ? "true" : "false");
    const issues = scanDiagnostics();
    badge.dataset.hot = issues.length > 0 ? "true" : "false";
    badge.textContent = issues.length === 0 ? "Spec OK" : `${issues.length} Spec Issue${issues.length === 1 ? "" : "s"}`;
    if (!drawer.hidden) renderDrawer(drawer, issues);
    if (rebuild || session.pick !== rendered) {
      rendered = session.pick;
      renderEditor(editor, session, () => paint(true));
    }
    const box = session.pick && session.pick.kind !== "text-range" ? session.pick.box : session.pick?.box;
    placeHighlight(highlight, session.pick ? box : undefined);
  };

  annotate.addEventListener("click", () => {
    const api = document.oai?.annotation;
    if (!api) return;
    api.toggle(!api.isActive());
    paint(false);
  });
  badge.addEventListener("click", () => {
    drawer.hidden = !drawer.hidden;
    paint(false);
  });
  editor.addEventListener("click", (event) => {
    const button = event.target instanceof Element ? event.target.closest("button") : null;
    if (button?.dataset.skyloupeRole === "copy") void copyPrompt(host, session);
    if (button?.dataset.skyloupeRole === "send") void sendToCodex(session, bridge);
  });
  document.addEventListener("keydown", (event) => {
    if (event.code === "Space") space = true;
    if (event.altKey && event.shiftKey && event.code === "KeyA" && mode === "polyfill-standalone") {
      document.oai?.annotation?.toggle();
      paint(false);
    }
    if (event.altKey && event.shiftKey && event.code === "KeyD") {
      drawer.hidden = !drawer.hidden;
      paint(false);
    }
  });
  document.addEventListener("keyup", (event) => {
    if (event.code === "Space") space = false;
  });
  document.addEventListener("pointerdown", (event) => {
    if (space || event.composedPath().some((node) => node instanceof Element && node.localName === "skyloupe-devtools-host")) return;
    if (document.oai?.annotation?.isActive() !== true) return;
    void pickAt(event.clientX, event.clientY).then((pick) => {
      if (!pick) return;
      session.pick = pick;
      session.changes = [];
      paint(true);
    });
  }, true);
  document.addEventListener("oaiannotationmodechange", () => paint(false));
  const observer = new MutationObserver(() => paint(false));
  observer.observe(document.body, { subtree: true, childList: true, attributes: true, attributeFilter: ["oai-annotatable", "oai-annotation-metadata"] });
  paint(true);
  const browserSession = mode === "polyfill-standalone" ? readBrowserSession() : null;
  if (browserSession) {
    void probeBridge(browserSession).then((connected) => {
      session.connected = connected;
      bridge.textContent = bridgeLamp(mode, connected).label;
      bridge.dataset.connected = connected ? "true" : "false";
      if (connected) {
        paint(true);
        void listenBridge(browserSession, (event) => {
          if (event.type === "reset" || (event.type === "turn" && event.status === "completed")) {
            session.resetPreview?.();
            bridge.textContent = "Codex Connected";
          } else if (event.message) bridge.textContent = event.message;
        });
      }
    });
  }
}

async function sendToCodex(session: EditorSession, bridge: HTMLElement): Promise<void> {
  const browserSession = readBrowserSession();
  const pick = session.pick;
  if (!browserSession || !pick) return;
  const element = pick.kind === "text-range" ? undefined : pick.element;
  const changes = withUnchangedChoices(session.changes, element ? registrationFor(element) : undefined);
  const bundle = await buildAnnotationBundle({ pick, changes, comment: session.comment });
  bridge.textContent = "Sending";
  await sendAnnotation(browserSession, bundle);
}

async function copyPrompt(host: HTMLElement, session: EditorSession): Promise<void> {
  const pick = session.pick;
  if (!pick) return;
  const element = pick.kind === "text-range" ? undefined : pick.element;
  const changes = withUnchangedChoices(session.changes, element ? registrationFor(element) : undefined);
  const bundle = await buildAnnotationBundle({ pick, changes, comment: session.comment });
  const markdown = formatAnnotationMarkdown(bundle);
  host.dataset.lastCopy = markdown;
  try {
    await navigator.clipboard.writeText(markdown);
  } catch {
    const area = document.createElement("textarea");
    area.value = markdown;
    host.shadowRoot?.append(area);
    area.select();
    document.execCommand("copy");
    area.remove();
  }
}
