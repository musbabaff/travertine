"use client";

import { useI18n, type MessageKey } from "@/i18n";
import type { Rotation } from "@/lib/api/types";
import { OBJECTIVES, type Objective } from "@/lib/priorities";

export const OBJECTIVE_COLOR: Record<Objective, string> = {
  water: "var(--viz-water)",
  income: "var(--viz-income)",
  soil: "var(--viz-soil)",
  risk: "var(--viz-risk)",
};

/** Four horizontal bars on one 0–1 scale, fixed order, value as a direct label. */
export function ScoreBars({ scores, compareTo }: { scores: Rotation["scores"]; compareTo?: Rotation["scores"] }) {
  const { t, n } = useI18n();
  return (
    <dl
      className="grid grid-cols-[minmax(5.5rem,auto)_1fr_auto] items-center gap-x-3 gap-y-2"
      aria-label={t("explore.scores.aria", { water: n(scores.water, 2), income: n(scores.income, 2), soil: n(scores.soil, 2), risk: n(scores.risk, 2), total: n(scores.total, 2) })}
    >
      {OBJECTIVES.map((k) => {
        const v = scores[k];
        const diff = compareTo ? v - compareTo[k] : null;
        return (
          <div key={k} className="contents">
            <dt className="text-xs text-ink-2">{t(`explore.score.${k}` as MessageKey)}</dt>
            <dd className="h-2 overflow-hidden rounded-full bg-sunken" aria-hidden>
              <div className="h-full rounded-full transition-[width] duration-[var(--dur-base)] ease-[var(--ease-out)]" style={{ width: `${v * 100}%`, background: OBJECTIVE_COLOR[k] }} />
            </dd>
            <dd className="min-w-[2.5rem] text-right text-xs font-semibold tabular-nums text-ink">
              {n(v, 2)}
              {diff !== null && Math.abs(diff) >= 0.005 && (
                <span className={`ml-1 font-normal ${diff > 0 ? "text-teal-700" : "text-ink-muted"}`}>
                  {diff > 0 ? "+" : "−"}
                  {n(Math.abs(diff), 2)}
                </span>
              )}
            </dd>
          </div>
        );
      })}
    </dl>
  );
}
