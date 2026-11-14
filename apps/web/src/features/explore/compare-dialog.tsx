"use client";

import { X } from "lucide-react";
import { useEffect, useRef } from "react";
import { WaterYearsChart } from "@/components/charts/water-years-chart";
import { useI18n } from "@/i18n";
import type { Crop, Rotation } from "@/lib/api/types";
import { CropTimeline, cropName } from "./crop-timeline";
import { ScoreBars } from "./score-bars";

/** Native modal dialog: focus trap, Escape and focus return come from the platform. */
export function CompareDialog({
  open,
  onClose,
  pair,
  ranks,
  crops,
  irrigated,
}: {
  open: boolean;
  onClose: () => void;
  pair: [Rotation, Rotation] | null;
  ranks: [number, number];
  crops?: Map<string, Crop>;
  irrigated: boolean;
}) {
  const { t, n } = useI18n();
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);

  const yMax = pair ? Math.max(...pair.flatMap((r) => r.yearly.map((y) => y.water_demand_mm))) : 0;

  return (
    <dialog
      ref={ref}
      onClose={onClose}
      aria-labelledby="compare-title"
      className="m-0 h-dvh max-h-none w-full max-w-none bg-canvas p-0 text-ink backdrop:bg-navy-900/40 md:m-auto md:h-fit md:max-h-[90dvh] md:w-[min(1100px,calc(100vw-48px))] md:rounded-lg md:shadow-3"
    >
      <div className="sticky top-0 z-10 flex items-center justify-between gap-3 border-b border-border bg-surface px-4 py-3 md:px-6">
        <h2 id="compare-title" className="text-h3 font-semibold">
          {t("explore.compare.title")}
        </h2>
        <button type="button" onClick={onClose} aria-label={t("explore.compare.close")} className="flex size-11 items-center justify-center rounded-md text-ink-2 hover:bg-sunken md:size-10">
          <X aria-hidden className="size-5" strokeWidth={1.5} />
        </button>
      </div>
      {pair && (
        <div className="grid gap-4 p-4 md:grid-cols-2 md:gap-6 md:p-6">
          {pair.map((r, i) => {
            const other = pair[1 - i];
            const demand = r.yearly.reduce((a, y) => a + y.water_demand_mm, 0);
            const deficit = r.yearly.reduce((a, y) => a + y.water_deficit_mm, 0);
            return (
              <section key={r.sequence.join(">")} aria-labelledby={`cmp-${i}`} className="min-w-0 rounded-md border border-border bg-surface p-4 md:p-5">
                <div className="flex items-start justify-between gap-3">
                  <h3 id={`cmp-${i}`} className="text-sm font-semibold">
                    <span className="text-ink-muted">#{ranks[i]} · </span>
                    {r.sequence.map((c) => cropName(c, crops)).join(" → ")}
                  </h3>
                  <span className="text-h3 font-semibold tabular-nums">{n(r.scores.total, 2)}</span>
                </div>
                <div className="mt-3">
                  <CropTimeline sequence={r.sequence} crops={crops} compact />
                </div>
                <div className="mt-4">
                  <ScoreBars scores={r.scores} compareTo={other.scores} />
                </div>
                <dl className="mt-4 grid grid-cols-2 gap-3 rounded-md bg-sunken p-3">
                  <div>
                    <dt className="text-xs text-ink-muted">{t("explore.compare.totalDemand")}</dt>
                    <dd className="text-sm font-semibold tabular-nums">{n(demand)} {t("unit.mm")}</dd>
                  </div>
                  <div>
                    <dt className="text-xs text-ink-muted">{t("explore.compare.totalDeficit")}</dt>
                    <dd className="text-sm font-semibold tabular-nums">{n(deficit)} {t("unit.mm")}</dd>
                  </div>
                </dl>
                <div className="mt-4">
                  <WaterYearsChart yearly={r.yearly} cropLabel={(c) => cropName(c, crops)} irrigated={irrigated} yMax={yMax} />
                </div>
              </section>
            );
          })}
        </div>
      )}
    </dialog>
  );
}
