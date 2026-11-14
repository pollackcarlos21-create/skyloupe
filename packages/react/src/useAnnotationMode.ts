import { useEffect, useState } from "react";

export function useAnnotationMode(): boolean {
  const [active, setActive] = useState(false);
  useEffect(() => {
    if (typeof document === "undefined") return;
    const read = () => setActive(Boolean(document.oai?.annotation?.isActive()));
    read();
    document.addEventListener("oaiannotationmodechange", read);
    return () => document.removeEventListener("oaiannotationmodechange", read);
  }, []);
  return active;
}
