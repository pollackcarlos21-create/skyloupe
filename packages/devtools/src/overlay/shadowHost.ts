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
.shell { position: fixed; inset: 0; pointer-events: none; z-index: 2147483646; font: 13px/1.45 Inter, ui-sans-serif, system-ui, -apple-system, "Segoe UI", "PingFang SC", "Noto Sans SC", sans-serif; color: #171717; }
.banner, .capsule, .editor, .drawer { pointer-events: auto; }
.banner, .capsule, .editor, .drawer, .editor button, .capsule button {
  border: 0;
  box-shadow:
    0 1px 1px rgba(23, 23, 23, 0.04),
    0 10px 24px rgba(23, 23, 23, 0.06),
    0 24px 48px rgba(23, 23, 23, 0.05);
}
.banner { position: fixed; top: 16px; left: 50%; transform: translateX(-50%); background: #fff; color: #171717; padding: 8px 14px; border-radius: 999px; }
.capsule { position: fixed; right: 20px; bottom: 20px; display: flex; gap: 8px; align-items: center; padding: 8px; background: #fff; color: #171717; border-radius: 999px; }
.capsule button, .editor button { border-radius: 999px; padding: 7px 12px; font: inherit; cursor: pointer; background: #fff; color: #171717; }
.annotate[aria-pressed="true"] { background: #171717; color: #fff; }
.badge { background: #fff; color: #171717; }
.badge[data-hot="true"] { color: #b91c1c; }
.bridge { background: transparent; box-shadow: none; color: #737373; }
.bridge[data-connected="true"] { color: #15803d; }
.editor, .drawer { position: fixed; background: #fff; border-radius: 20px; }
.editor { right: 20px; bottom: 84px; width: 280px; max-height: 70vh; overflow: auto; padding: 16px; display: grid; gap: 12px; }
.editor h2 { margin: 0; font-size: 16px; font-weight: 600; }
.editor .source, .drawer p { margin: 0; color: #737373; }
.editor label { display: grid; gap: 6px; font-size: 12px; color: #404040; }
.editor input, .editor select, .editor textarea { width: 100%; font: inherit; border: 0; background: #fafafa; border-radius: 10px; }
.editor textarea { min-height: 64px; padding: 8px; }
.editor .row { display: flex; gap: 8px; }
.drawer { left: 20px; bottom: 20px; width: min(360px, calc(100vw - 40px)); max-height: 48vh; overflow: auto; padding: 16px; display: grid; gap: 12px; }
.issue, .issue.warn { display: grid; gap: 4px; padding: 4px 0 4px 16px; background: transparent; position: relative; }
.issue::before, .issue.warn::before { content: ""; position: absolute; left: 0; top: 8px; width: 8px; height: 8px; border-radius: 999px; background: #b91c1c; }
.issue.warn::before { background: #d97706; }
.highlight { position: fixed; border: 0; border-radius: 10px; box-shadow: 0 0 0 2px rgba(15, 118, 110, 0.45), 0 10px 28px rgba(15, 118, 110, 0.18); pointer-events: none; }
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
