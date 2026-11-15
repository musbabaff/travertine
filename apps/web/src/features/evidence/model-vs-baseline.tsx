"use client";

import { useI18n, type MessageKey } from "@/i18n";
import type { Validation } from "@/lib/api/types";

type Interval = [number, number];

/** Point estimate with its 95 % interval on a fixed scale, zero marked. Values are written out next to the graphic. */
const GRID = "grid grid-cols-1 gap-1 sm:grid-cols-[minmax(9rem,14rem)_1fr_15rem] sm:items-center sm:gap-3";

/** r is omitted for the difference: the contract carries only its interval. */
function IntervalRow({ label, r, ci, min, max, color, className = "" }: { label: string; r?: number; ci: Interval; min: number; max: number; color: string; className?: string }) {
  const { t, n } = useI18n();
  const pos = (v: number) => `${((Math.max(min, Math.min(max, v)) - min) / (max - min)) * 100}%`;
  return (
    <div className={`${GRID} ${className}`}>
      <dt className="text-sm text-ink">{label}</dt>
      <dd aria-hidden className="relative h-6">
        <span className="absolute inset-x-0 top-1/2 h-px bg-border" />
        <span className="absolute top-0 h-6 w-px bg-border-strong" style={{ left: pos(0) }} />
        <span className="absolute top-1/2 h-1.5 -translate-y-1/2 rounded-full opacity-30" style={{ left: pos(ci[0]), width: `calc(${pos(ci[1])} - ${pos(ci[0])})`, background: color }} />
        {r !== undefined && <span className="absolute top-1/2 size-3 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-surface" style={{ left: pos(r), background: color }} />}
      </dd>
      <dd className="text-sm tabular-nums text-ink">
        {r !== undefined && <span className="mr-2 font-semibold">{t("evidence.r.value", { r: n(r, 2) })}</span>}
        <span className="text-ink-2">{t("evidence.compare.ci", { lo: n(ci[0], 2), hi: n(ci[1], 2) })}</span>
      </dd>
    </div>
  );
}

/**
 * Model against the climate-only baseline, with both 95 % intervals, the interval of the difference and the
 * pre-registered verdict. Rendered only when the response carries all of these fields.
 */
export function ModelVsBaseline({ v }: { v: Validation }) {
  const { t, n } = useI18n();
  if (!v.baseline || !v.correlation_ci95 || !v.difference_ci95 || !v.verdict) return null;
  return (
    <section aria-labelledby="compare-title" className="rounded-md border border-border bg-surface p-4 shadow-1 md:p-5" data-testid="model-vs-baseline">
      <h2 id="compare-title" className="text-h3 font-semibold">
        {t("evidence.compare.title")}
      </h2>
      <p className="mt-0.5 text-xs text-ink-muted">{t("evidence.compare.subtitle", { n: v.n })}</p>

      <dl className="mt-4 space-y-3">
        <IntervalRow label={t("evidence.compare.model")} r={v.correlation} ci={v.correlation_ci95 as Interval} min={-1} max={1} color="var(--viz-model)" />
        <IntervalRow label={v.baseline.name} r={v.baseline.correlation} ci={v.baseline.correlation_ci95 as Interval} min={-1} max={1} color="var(--viz-neutral)" />
        <IntervalRow className="border-t border-border pt-3" label={t("evidence.compare.diff")} ci={v.difference_ci95 as Interval} min={-1} max={1} color="var(--viz-observed)" />
      </dl>
      <div aria-hidden className={`${GRID} mt-1`}>
        <span className="hidden sm:block" />
        <span className="relative h-4 text-xs tabular-nums text-ink-muted">
          <span className="absolute left-0">{n(-1, 0)}</span>
          <span className="absolute left-1/2 -translate-x-1/2">0</span>
          <span className="absolute right-0">{n(1, 0)}</span>
        </span>
      </div>

      <p className="mt-4 rounded-md bg-sunken px-3 py-2 text-sm text-ink" data-testid="verdict">
        <span className="font-semibold">{t("evidence.compare.verdict")}: </span>
        {t(`evidence.verdict.${v.verdict}` as MessageKey)}
      </p>
      <p className="mt-2 text-xs text-ink-muted">{t("evidence.compare.rule")}</p>
    </section>
  );
}
