"use client";

import { Check, ChevronDown } from "lucide-react";
import { useId, useState } from "react";
import { WaterYearsChart } from "@/components/charts/water-years-chart";
import { useDataSource } from "@/lib/api/source";
import { useI18n } from "@/i18n";
import type { Crop, Rotation } from "@/lib/api/types";
import { explanationText } from "@/lib/localize-engine";
import { CropTimeline, cropName } from "./crop-timeline";
import { ReasoningParts } from "./reasoning";
import { ScoreBars } from "./score-bars";

export const rotationKey = (r: Rotation) => r.sequence.join(">");

export function RotationCard({
  rotation,
  rank,
  crops,
  irrigated,
  selected,
  selectDisabled,
  onToggleSelect,
  delta,
  isBaseline = false,
  violations,
}: {
  rotation: Rotation;
  rank: number;
  crops?: Map<string, Crop>;
  irrigated: boolean;
  selected: boolean;
  selectDisabled: boolean;
  onToggleSelect: () => void;
  delta?: Rotation["vs_baseline"];
  isBaseline?: boolean;
  violations?: { rule: string; year_index?: number; message: string }[];
}) {
  const { t, n, locale } = useI18n();
  const source = useDataSource();
  const englishOnly = source !== "engine" && locale === "tr";
  const [showWater, setShowWater] = useState(false);
  const id = useId();
  const top = rank === 1;

  return (
    <article
      aria-labelledby={`${id}-title`}
      className={`rounded-md border bg-surface p-4 shadow-1 transition-colors duration-[var(--dur-fast)] md:p-5 ${selected ? "border-teal-700 ring-1 ring-teal-700" : "border-border"}`}
    >
      <header className="flex items-start gap-3">
        <span
          className={`flex size-8 shrink-0 items-center justify-center rounded-full text-sm font-semibold tabular-nums ${top ? "bg-accent text-white" : "bg-sunken text-ink-2"}`}
          aria-hidden
        >
          {rank}
        </span>
        <div className="min-w-0 flex-1">
          <h3 id={`${id}-title`} className="text-sm font-semibold text-ink">
            <span className="sr-only">{t("explore.rank", { n: rank })}: </span>
            {rotation.sequence.map((c) => cropName(c, crops, locale)).join(" → ")}
          </h3>
        </div>
        <div className="shrink-0 text-right">
          <span className="block text-[11px] font-medium uppercase tracking-[0.04em] text-ink-muted">{t("explore.total")}</span>
          <span className="text-h3 font-semibold tabular-nums text-ink">{n(rotation.scores.total, 2)}</span>
        </div>
      </header>

      <div className="mt-4">
        <CropTimeline sequence={rotation.sequence} crops={crops} />
      </div>

      <div className="mt-4">
        <ScoreBars scores={rotation.scores} delta={delta} />
        {delta && <p className="mt-1 text-xs text-ink-muted">{t("current.deltaNote")}</p>}
        {isBaseline && violations && violations.length > 0 && (
          <div className="mt-3 rounded-md border border-warning/30 bg-warning-bg p-3" data-testid="rule-violations">
            <p className="text-xs font-semibold text-warning">{t("current.violations")}</p>
            <ul className="mt-1 space-y-1 text-sm text-ink-2">
              {violations.map((v) => (
                <li key={`${v.rule}-${v.year_index ?? 0}`}>{v.message}</li>
              ))}
            </ul>
          </div>
        )}
        {isBaseline && violations && violations.length === 0 && <p className="mt-2 text-xs text-ink-muted">{t("current.noViolations")}</p>}
      </div>

      {/* P10/P50/P90 range display slots in here once the contract carries percentile outcomes. */}
      {rotation.reasoning && <ReasoningParts reasoning={rotation.reasoning} />}

      {rotation.explanation.length > 0 && (
        <div className="mt-4">
          <h4 className="text-xs font-medium text-ink-2">{t("explore.why")}</h4>
          {englishOnly && <p className="mt-1 text-xs text-warning">{t("demo.englishOnly")}</p>}
          <ul className="mt-1.5 space-y-1 text-sm text-ink-2" lang={englishOnly ? "en" : undefined}>
            {rotation.explanation.map((e) => (
              <li key={e} className="flex gap-2">
                <span aria-hidden className="mt-2 size-1 shrink-0 rounded-full bg-ink-muted" />
                <span>{explanationText(e, locale)}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-border pt-3">
        <button
          type="button"
          aria-expanded={showWater}
          aria-controls={`${id}-water`}
          onClick={() => setShowWater((v) => !v)}
          className="-ml-2 inline-flex min-h-9 items-center gap-1 rounded-md px-2 text-sm font-medium text-teal-700 hover:bg-teal-100"
        >
          <ChevronDown aria-hidden className={`size-4 transition-transform duration-[var(--dur-base)] ${showWater ? "rotate-180" : ""}`} strokeWidth={1.5} />
          {showWater ? t("explore.waterByYear.hide") : t("explore.waterByYear")}
        </button>
        <button
          type="button"
          aria-pressed={selected}
          disabled={selectDisabled && !selected}
          onClick={onToggleSelect}
          className={`inline-flex min-h-9 items-center gap-1.5 rounded-md border px-3 text-sm font-medium disabled:cursor-not-allowed disabled:opacity-50 ${
            selected ? "border-teal-700 bg-teal-100 text-teal-700" : "border-border-strong bg-surface text-ink hover:bg-sunken"
          }`}
        >
          <span aria-hidden className={`flex size-4 items-center justify-center rounded-[4px] border ${selected ? "border-teal-700 bg-teal-700 text-white" : "border-border-strong"}`}>
            {selected && <Check className="size-3" strokeWidth={2.5} />}
          </span>
          {t("explore.compare.select")}
        </button>
      </div>

      {showWater && (
        <div id={`${id}-water`} className="mt-3">
          <WaterYearsChart yearly={rotation.yearly} cropLabel={(c) => cropName(c, crops, locale)} irrigated={irrigated} />
        </div>
      )}
    </article>
  );
}
