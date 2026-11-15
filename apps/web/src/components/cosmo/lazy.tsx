"use client";

import dynamic from "next/dynamic";
import { Suspense, useEffect, useState } from "react";

// Cosmo's code (chat, tour, SVG mascot) is fetched only after the first interaction, so it never competes with the first
// render. three.js and the 3D model load later still, only when the guide is opened (see stage.tsx).
const CosmoAssistant = dynamic(() => import("./assistant"), { ssr: false });
const CosmoIntro = dynamic(() => import("./intro"), { ssr: false });

export function LazyCosmo() {
  const [ready, setReady] = useState(false);
  useEffect(() => {
    // First interaction, or 10 s after load at the latest. Keeps three.js out of the first render and page load.
    const start = () => setReady(true);
    const events = ["pointerdown", "keydown", "scroll", "touchstart"] as const;
    events.forEach((e) => window.addEventListener(e, start, { once: true, passive: true }));
    const t = setTimeout(start, 10_000);
    return () => {
      clearTimeout(t);
      events.forEach((e) => window.removeEventListener(e, start));
    };
  }, []);
  if (!ready) return null;
  return (
    <>
      <Suspense fallback={null}>
        <CosmoAssistant />
      </Suspense>
      <CosmoIntro />
    </>
  );
}
