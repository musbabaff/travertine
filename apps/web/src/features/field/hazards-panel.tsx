"use client";

import { pickProvenance, ProvenanceChips } from "@/components/ui/provenance-chip";
import { Skeleton } from "@/components/ui/states";
import { useI18n, type MessageKey } from "@/i18n";
import type { FieldState } from "@/lib/url-state";
import { useHazards } from "./use-hazards";

const ROWS: { key: string; label: MessageKey; unit?: MessageKey; digits?: number }[] = [
  { key: "frost_days", label: "hazards.frostDays", unit: "hazards.unit.days" },
  { key: "frost_free_days", label: "hazards.frostFree", unit: "hazards.unit.days" },
  { key: "summer_days", label: "hazards.summerDays", unit: "hazards.unit.days" },
  { key: "warm_days", label: "hazards.warmDays", unit: "hazards.unit.days" },
  { key: "txx_c", label: "hazards.txx", unit: "unit.c", digits: 1 },
  { key: "r20mm_days", label: "hazards.r20", unit: "hazards.unit.days" },
  { key: "rx1day_mm", label: "hazards.rx1day", unit: "unit.mm", digits: 1 },
  { key: "cdd_days", label: "hazards.cdd", unit: "hazards.unit.days" },
];

/** Frost dates and frost-free season, hot days, extreme rain and dry spells: medians over the POWER record. */
export function HazardsPanel({ field }: { field: FieldState }) {
  const { t, n, locale } = useI18n();
  const q = useHazards(field);
  const doy = (d: number) =>
    new Intl.DateTimeFormat(locale === "tr" ? "tr-TR" : "en-GB", { day: "numeric", month: "long", timeZone: "UTC" }).format(new Date(Date.UTC(2001, 0, Math.round(d))));

  if (q.isPending) return <Skeleton className="h-32 w-full" />;
  if (q.isError || !q.data) return <p className="text-sm text-ink-2">{t("hazards.failed")}</p>;
  const { data, fromFixture } = q.data;
  const m = data.median;
  const years = data.years.map((y) => y.year);
  return (
    <div data-testid="hazards">
      <p className="-mt-1.5 mb-3 text-xs text-ink-muted">{t("hazards.period", { from: Math.min(...years), to: Math.max(...years), n: years.length })}</p>
      {fromFixture && <p className="mb-2 text-xs text-warning">{t("source.demo")}</p>}
      {m.last_spring_frost_doy !== undefined && m.first_autumn_frost_doy !== undefined && (
        <p className="mb-3 text-sm text-ink">
          {t("hazards.frostDates", { spring: doy(m.last_spring_frost_doy), autumn: doy(m.first_autumn_frost_doy) })}
        </p>
      )}
      <dl className="grid grid-cols-2 gap-x-4 gap-y-3">
        {ROWS.filter((r) => m[r.key] !== undefined).map((r) => (
          <div key={r.key} className="min-w-0">
            <dt className="text-xs text-ink-muted">{t(r.label)}</dt>
            <dd className="mt-0.5 text-sm font-semibold tabular-nums text-ink">
              {n(m[r.key], r.digits ?? 0)} {r.unit ? <span className="text-xs font-normal text-ink-muted">{t(r.unit)}</span> : null}
            </dd>
          </div>
        ))}
      </dl>
      {locale === "tr" && <p className="mt-3 text-xs text-ink-muted">{t("hazards.englishOnly")}</p>}
      <ul className="mt-3 space-y-1 text-xs text-ink-2" lang="en" data-engine-text>
        {data.caveats.map((c) => (
          <li key={c}>{c}</li>
        ))}
      </ul>
      <div className="mt-2">
        <ProvenanceChips items={pickProvenance(data.provenance, /.*/)} />
      </div>
    </div>
  );
}
