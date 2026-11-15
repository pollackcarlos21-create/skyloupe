import { useEffect, useRef, useState } from "react";
import { Annotatable, useAnnotationControls } from "@skyloupe/react";
import { applyAnnotation, type MockBundle } from "./mockBridge";

const copy = {
  en: {
    title: "Playground",
    lead: "Annotate, tune, and send. Codex is mocked in this browser.",
    heading: "Card appearance",
    padding: "Card padding",
    radius: "Card radius",
    plan: "Pro",
    price: "$29",
    perMonth: "/ month",
    trial: "Start free trial",
    applied: "Codex applied the change in this browser.",
    language: "Language",
  },
  zh: {
    title: "演练场",
    lead: "标注、调节、发送。这个页面在浏览器里模拟 Codex。",
    heading: "卡片外观",
    padding: "卡片内边距",
    radius: "卡片圆角",
    plan: "Pro",
    price: "$29",
    perMonth: "/ 月",
    trial: "开始免费试用",
    applied: "已在这个浏览器里模拟 Codex 改完。",
    language: "语言",
  },
} as const;

type Lang = keyof typeof copy;

export function App() {
  const [lang, setLang] = useState<Lang>("en");
  const [applied, setApplied] = useState(false);
  const text = copy[lang];
  useEffect(() => {
    const mark = () => setApplied(true);
    document.addEventListener("skyloupe:playground-applied", mark);
    return () => document.removeEventListener("skyloupe:playground-applied", mark);
  }, []);
  const ref = useRef<HTMLElement>(null);
  useAnnotationControls(ref, {
    controlsHeading: text.heading,
    controls: [
      {
        type: "range",
        label: text.padding,
        callback: "setPadding",
        reference: "--card-padding",
        cssVar: "--card-padding",
        unit: "px",
        min: 12,
        max: 48,
        step: 2,
        currentValue: 24,
      },
      {
        type: "range",
        label: text.radius,
        callback: "setRadius",
        reference: "--card-radius",
        cssVar: "--card-radius",
        unit: "px",
        min: 0,
        max: 32,
        step: 1,
        currentValue: 20,
      },
    ],
  });
  return (
    <main className="app">
      <div className="top">
        <div>
          <h1>{text.title}</h1>
          <p>{text.lead}</p>
        </div>
        <div role="group" aria-label={text.language}>
          <button className="lang" type="button" aria-pressed={lang === "en"} onClick={() => setLang("en")}>EN</button>
          <button className="lang" type="button" aria-pressed={lang === "zh"} onClick={() => setLang("zh")}>中文</button>
        </div>
      </div>
      <Annotatable
        as="article"
        ref={ref}
        className="card"
        id="playground-card"
        name="Playground card"
        metadata={{ planId: "Pro", monthlyPrice: 29 }}
      >
        <h2>{text.plan}</h2>
        <p className="price"><strong>{text.price}</strong> {text.perMonth}</p>
        <button className="cta" type="button">{text.trial}</button>
      </Annotatable>
      <p className="status" hidden={!applied} data-applied={applied ? "true" : "false"}>{text.applied}</p>
    </main>
  );
}

export function acceptPlaygroundSend(bundle: MockBundle): void {
  const card = document.getElementById("playground-card");
  if (!(card instanceof HTMLElement)) return;
  applyAnnotation(card, bundle);
  const status = document.querySelector(".status");
  if (status instanceof HTMLElement) status.hidden = false;
  document.dispatchEvent(new Event("skyloupe:playground-applied"));
}
