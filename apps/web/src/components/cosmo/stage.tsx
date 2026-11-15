"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import CosmoMascot, { type CosmoPose } from "./mascot";
import type { CosmoMood, CosmoView } from "./scene";

// 3B Cosmo. SVG çizim yalnızca WebGL açılamazsa görünür; yükleme sırasında kutu boş kalır.
export default function CosmoStage({
  view = "full",
  pose = "idle",
  talking = false,
  listening = false,
  facing = 0,
}: {
  view?: CosmoView;
  pose?: CosmoPose;
  talking?: boolean;
  listening?: boolean;
  facing?: number;
}) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const mood = useRef<CosmoMood>({ pose, talking, listening, facing });
  const [state, setState] = useState<"loading" | "live" | "failed">("loading");

  useLayoutEffect(() => {
    mood.current = { pose, talking, listening, facing };
  }, [pose, talking, listening, facing]);

  useEffect(() => {
    let unmount: (() => void) | undefined;
    let gone = false;
    import("./scene")
      .then(({ mountCosmo }) => mountCosmo(canvas.current!, view, () => mood.current, () => setState("live")))
      .then((dispose) => (gone ? dispose() : (unmount = dispose)))
      .catch(() => setState("failed"));
    return () => {
      gone = true;
      unmount?.();
    };
  }, [view]);

  return (
    <span className={`cosmo-stage cosmo-stage-${view}${state === "live" ? " is-live" : ""}`}>
      {state === "failed" ? (
        <CosmoMascot frame={view === "bust" ? "chat" : "full"} pose={pose} talking={talking} listening={listening} label={null} />
      ) : (
        <canvas ref={canvas} aria-hidden="true" />
      )}
    </span>
  );
}
