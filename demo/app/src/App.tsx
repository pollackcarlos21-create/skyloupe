import { useEffect, useState } from "react";
import { PricingCard } from "./components/PricingCard";
import { RevenueChart } from "./components/RevenueChart";

export function App() {
  const [theme, setTheme] = useState<"light" | "dark">("light");
  useEffect(() => {
    document.documentElement.dataset.theme = theme;
  }, [theme]);
  return (
    <main className="app" data-theme={theme}>
      <div className="top">
        <div>
          <p className="eyebrow">Northwind billing</p>
          <h1>Pricing that can be annotated.</h1>
        </div>
        <button
          className="theme"
          type="button"
          onClick={() => {
            const next = theme === "light" ? "dark" : "light";
            setTheme(next);
            document.documentElement.dataset.theme = next;
          }}
        >
          {theme === "light" ? "Dark" : "Light"}
        </button>
      </div>
      <div className="stage" oai-annotation-container="">
        <div className="cards">
          <PricingCard planId="Starter" price={12} />
          <PricingCard planId="Pro" price={29} featured />
        </div>
        <section className="chart-panel">
          <h2>Revenue</h2>
          <p>Each quarter is its own canvas object. Q3 Revenue can be selected on its own.</p>
          <RevenueChart />
        </section>
        <p className="planted" oai-annotatable="Legacy note" oai-annotation-metadata='{"owner":{"team":"growth"}}'>
          Planted issue: nested metadata.
        </p>
      </div>
      <span className="badge" oai-annotatable="Launch badge">Planted issue: annotatable outside a container.</span>
    </main>
  );
}
