import type { AnnotationPick } from "../polyfill/picker";

const SENSITIVE = "[data-skyloupe-ignore], [data-1p-ignore]";

export function maskTree(root: Element): void {
  const nodes = root instanceof Element ? [root, ...Array.from(root.querySelectorAll("*"))] : [];
  for (const node of nodes) {
    if (!(node instanceof HTMLElement)) continue;
    if (node.matches(SENSITIVE)) node.textContent = "";
    if (node instanceof HTMLInputElement || node instanceof HTMLTextAreaElement) {
      const auto = node.getAttribute("autocomplete") ?? "";
      if (node.type === "password" || auto.toLowerCase().startsWith("cc-") || node.matches(SENSITIVE)) {
        node.value = "••••";
        node.setAttribute("value", "••••");
      }
    }
  }
}

export function maskedExcerpt(element: Element): string | undefined {
  const clone = element.cloneNode(true);
  if (!(clone instanceof Element)) return undefined;
  maskTree(clone);
  const text = (clone.textContent ?? "").replace(/\s+/g, " ").trim();
  return text.length > 0 ? text.slice(0, 240) : undefined;
}

export async function captureTarget(pick: AnnotationPick, omitScreenshot = false): Promise<string | undefined> {
  if (omitScreenshot) return undefined;
  const raced = Promise.race([
    render(pick),
    new Promise<undefined>((resolve) => setTimeout(() => resolve(undefined), 400)),
  ]);
  try {
    return await raced;
  } catch {
    return borderPng(boxOf(pick));
  }
}

async function render(pick: AnnotationPick): Promise<string | undefined> {
  try {
    if (pick.kind === "canvas-object") return drawCanvas(pick.element, pick.box);
    if (pick.kind === "element") return await drawElement(pick.element);
    return borderPng(pick.box);
  } catch {
    return borderPng(boxOf(pick));
  }
}

function drawCanvas(canvas: HTMLCanvasElement, box?: { x: number; y: number; width: number; height: number }): string {
  canvas.toDataURL("image/png");
  const copy = document.createElement("canvas");
  copy.width = canvas.width || 1;
  copy.height = canvas.height || 1;
  const ctx = copy.getContext("2d");
  if (!ctx) return borderPng(box) ?? "";
  ctx.drawImage(canvas, 0, 0);
  if (box) {
    const scaleX = canvas.width / (canvas.getBoundingClientRect().width || canvas.width);
    const scaleY = canvas.height / (canvas.getBoundingClientRect().height || canvas.height);
    const host = canvas.getBoundingClientRect();
    ctx.strokeStyle = "#d97706";
    ctx.lineWidth = 3;
    ctx.strokeRect((box.x - host.left) * scaleX, (box.y - host.top) * scaleY, box.width * scaleX, box.height * scaleY);
  }
  return copy.toDataURL("image/png");
}

async function drawElement(element: Element): Promise<string | undefined> {
  const rect = element.getBoundingClientRect();
  const width = Math.max(1, Math.round(rect.width));
  const height = Math.max(1, Math.round(rect.height));
  const clone = element.cloneNode(true);
  if (clone instanceof HTMLElement) {
    maskTree(clone);
    copyStyle(element, clone);
  }
  const markup = clone instanceof Element ? clone.outerHTML : "";
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}"><foreignObject width="100%" height="100%"><div xmlns="http://www.w3.org/1999/xhtml">${markup}</div></foreignObject></svg>`;
  const image = new Image();
  await new Promise<void>((resolve, reject) => {
    image.onload = () => resolve();
    image.onerror = () => reject(new Error("snapshot"));
    image.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
  });
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  canvas.getContext("2d")?.drawImage(image, 0, 0);
  return canvas.toDataURL("image/png");
}

function copyStyle(source: Element, clone: HTMLElement): void {
  if (!(source instanceof HTMLElement)) return;
  const style = getComputedStyle(source);
  clone.style.color = style.color;
  clone.style.background = style.backgroundColor;
  clone.style.font = style.font;
  clone.style.padding = style.padding;
  clone.style.borderRadius = style.borderRadius;
  clone.style.boxSizing = "border-box";
  clone.style.width = `${source.getBoundingClientRect().width}px`;
}

function borderPng(box?: { width: number; height: number }): string | undefined {
  try {
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(box?.width ?? 120));
    canvas.height = Math.max(1, Math.round(box?.height ?? 80));
    const ctx = canvas.getContext("2d");
    if (!ctx) return undefined;
    ctx.fillStyle = "#fffbeb";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.strokeStyle = "#d97706";
    ctx.lineWidth = 4;
    ctx.strokeRect(2, 2, canvas.width - 4, canvas.height - 4);
    return canvas.toDataURL("image/png");
  } catch {
    return undefined;
  }
}

function boxOf(pick: AnnotationPick): { width: number; height: number } | undefined {
  if (pick.kind === "text-range") return pick.box;
  return pick.box;
}
