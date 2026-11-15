"use client";

import { RotateCcw } from "lucide-react";
import { Slider } from "@/components/ui/slider";
import { useI18n } from "@/i18n";

export interface ScenarioValue {
  precipitation_factor: number;
  temperature_change_c: number;
}

export const NO_SCENARIO: ScenarioValue = { precipitation_factor: 1, temperature_change_c: 0 };
export const isActive = (s: ScenarioValue) => s.precipitation_factor !== 1 || s.temperature_change_c !== 0;

/** Rainfall × 0.5–1.5 and temperature −3 to +5 °C applied to the past daily record (engine scenario). */
export function ScenarioPanel({ value, onChange }: { value: ScenarioValue; onChange: (s: ScenarioValue) => void }) {
  const { t, n } = useI18n();
  const rainPct = Math.round((value.precipitation_factor - 1) * 100);
  return (
    <section aria-labelledby="scenario-title" className="rounded-md border border-border bg-surface p-4 shadow-1 md:p-5" data-testid="scenario-panel">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 id="scenario-title" className="text-h3 font-semibold">
            {t("scenario.title")}
          </h2>
          <p className="mt-0.5 text-xs text-ink-muted">{t("scenario.hint")}</p>
        </div>
        <button
          type="button"
          onClick={() => onChange(NO_SCENARIO)}
          disabled={!isActive(value)}
          className="inline-flex min-h-9 shrink-0 items-center gap-1 rounded-md px-2 text-xs font-medium text-teal-700 hover:bg-teal-100 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <RotateCcw aria-hidden className="size-3.5" strokeWidth={1.5} />
          {t("scenario.reset")}
        </button>
      </div>
      <div className="mt-3 space-y-3">
        <Slider
          label={t("scenario.rain")}
          value={value.precipitation_factor - 0.5}
          valueText={`${rainPct > 0 ? "+" : ""}${n(rainPct)} %`}
          onChange={(v) => onChange({ ...value, precipitation_factor: Math.round((0.5 + v) * 20) / 20 })}
          color="var(--viz-water)"
        />
        <Slider
          label={t("scenario.temp")}
          value={(value.temperature_change_c + 3) / 8}
          valueText={`${value.temperature_change_c > 0 ? "+" : ""}${n(value.temperature_change_c, 1)} °C`}
          onChange={(v) => onChange({ ...value, temperature_change_c: Math.round((-3 + 8 * v) * 2) / 2 })}
          color="var(--viz-risk)"
        />
      </div>
      <p className="mt-3 text-xs font-medium text-warning">{t("scenario.notForecast")}</p>
    </section>
  );
}
