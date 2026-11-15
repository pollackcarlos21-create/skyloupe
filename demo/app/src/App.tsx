import { useEffect, useState } from "react";
import { PricingCard } from "./components/PricingCard";
import { RevenueChart } from "./components/RevenueChart";

const copy = {
  en: {
    eyebrow: "Northwind billing",
    title: "Pricing that can be annotated.",
    revenue: "Revenue",
    chart: "Each quarter is its own canvas object. Q3 Revenue can be selected on its own.",
    nested: "Planted issue: nested metadata.",
    isolated: "Planted issue: annotatable outside a container.",
    heading: "Card appearance",
    padding: "Card padding",
    radius: "Card radius",
    accent: "Accent color",
    tone: "Button tone",
    perMonth: "/ month",
    trial: "Start free trial",
    sales: "Talk to sales",
    starterFeatures: ["Shared annotation inbox", "DOM element controls", "Local Codex bridge"] as const,
    proFeatures: ["Priority annotation review", "Canvas object controls", "Local Codex bridge"] as const,
    quarters: ["Q1 Revenue", "Q2 Revenue", "Q3 Revenue", "Q4 Revenue"] as const,
    barColor: "Bar color",
    barRadius: "Bar radius",
    quarterHeading: "Quarter bar",
  },
  zh: {
    eyebrow: "北风账单",
    title: "可以标注的定价。",
    revenue: "营收",
    chart: "每个季度都是独立的画布对象。可以单独选中 Q3 营收。",
    nested: "预埋问题：嵌套的 metadata。",
    isolated: "预埋问题：容器外的可标注元素。",
    heading: "卡片外观",
    padding: "卡片内边距",
    radius: "卡片圆角",
    accent: "强调色",
    tone: "按钮语气",
    perMonth: "/ 月",
    trial: "开始免费试用",
    sales: "联系销售",
    starterFeatures: ["共享标注收件箱", "DOM 元素控件", "本地 Codex 桥"] as const,
    proFeatures: ["优先标注复查", "画布对象控件", "本地 Codex 桥"] as const,
    quarters: ["Q1 营收", "Q2 营收", "Q3 营收", "Q4 营收"] as const,
    barColor: "柱子颜色",
    barRadius: "柱子圆角",
    quarterHeading: "季度柱",
  },
} as const;

type Lang = keyof typeof copy;

function readLang(): Lang {
  try {
    return localStorage.getItem("skyloupe-demo-lang") === "zh" ? "zh" : "en";
  } catch {
    return "en";
  }
}

export function App() {
  const [lang, setLang] = useState<Lang>(readLang);
  const text = copy[lang];
  useEffect(() => {
    try {
      localStorage.setItem("skyloupe-demo-lang", lang);
    } catch {
      /* private mode */
    }
    document.documentElement.lang = lang === "zh" ? "zh-CN" : "en";
  }, [lang]);
  return (
    <main className="app">
      <div className="top">
        <div>
          <p className="eyebrow">{text.eyebrow}</p>
          <h1>{text.title}</h1>
        </div>
        <div className="tools" role="group" aria-label={lang === "zh" ? "语言" : "Language"}>
          <button className="lang" type="button" aria-pressed={lang === "en"} onClick={() => setLang("en")}>EN</button>
          <button className="lang" type="button" aria-pressed={lang === "zh"} onClick={() => setLang("zh")}>中文</button>
        </div>
      </div>
      <div className="stage" oai-annotation-container="">
        <div className="cards">
          <PricingCard planId="Starter" price={12} text={text} features={text.starterFeatures} />
          <PricingCard planId="Pro" price={29} featured text={text} features={text.proFeatures} />
        </div>
        <section className="chart-panel">
          <h2>{text.revenue}</h2>
          <p>{text.chart}</p>
          <RevenueChart names={text.quarters} colorLabel={text.barColor} radiusLabel={text.barRadius} heading={text.quarterHeading} />
        </section>
        <p className="planted" oai-annotatable="Legacy note" oai-annotation-metadata='{"owner":{"team":"growth"}}'>
          {text.nested}
        </p>
      </div>
      <span className="badge" oai-annotatable="Launch badge">{text.isolated}</span>
    </main>
  );
}
