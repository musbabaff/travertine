"use client";

import { useEffect, useRef } from "react";

export const COSMO_ASK = "cosmo:ask";

/** Set when Cosmo is summoned before its code has loaded; the assistant opens itself when it mounts. */
export const COSMO_PENDING = "__cosmoPending";

export function summonCosmo(question?: string) {
  (window as unknown as Record<string, unknown>)[COSMO_PENDING] = question ?? true;
  window.dispatchEvent(new CustomEvent(COSMO_ASK, { detail: question }));
}

// Göz bebekleri imleci izler: bağlanan öğeye --gaze-x / --gaze-y (-1..1) yazar.
export function useGaze<T extends HTMLElement>() {
  const target = useRef<T>(null);

  useEffect(() => {
    const node = target.current;
    if (!node || !window.matchMedia("(hover: hover) and (prefers-reduced-motion: no-preference)").matches) return;

    let frame = 0;
    function follow(event: PointerEvent) {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const box = node!.getBoundingClientRect();
        const dx = event.clientX - (box.left + box.width / 2);
        const dy = event.clientY - (box.top + box.height * 0.4);
        const reach = Math.max(Math.hypot(dx, dy), 160);
        node!.style.setProperty("--gaze-x", (dx / reach).toFixed(2));
        node!.style.setProperty("--gaze-y", (dy / reach).toFixed(2));
      });
    }
    window.addEventListener("pointermove", follow, { passive: true });
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("pointermove", follow);
    };
  }, []);

  return target;
}
