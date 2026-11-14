"use client";

import { SlowHint } from "@/components/ui/slow-hint";
import { Info } from "lucide-react";
import type { ReactNode } from "react";
import { WaterBalanceChart } from "@/components/charts/water-balance-chart";
import { pickProvenance, ProvenanceChips } from "@/components/ui/provenance-chip";
import { ErrorState, Skeleton } from "@/components/ui/states";
import { useI18n, type MessageKey } from "@/i18n";
import { FIXTURE_LOCATION } from "@/lib/api/mock";
import { useDataSource } from "@/lib/api/source";
import type { FieldAnalysis } from "@/lib/api/types";
import { distanceKm } from "@/lib/geo";
import type { FieldState } from "@/lib/url-state";

const mean = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;

function Section({ title, sources, children }: { title: string; sources?: ReactNode; children: ReactNode }) {
  return (
    <section className="border-t border-border pt-5">
      <div className="mb-3 flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1.5">
        <h3 className="text-sm font-semibold text-ink">{title}</h3>
        {sources}
      </div>
      {children}
    </section>
  );
}

function Stat({ label, value, unit, hint }: { label: string; value: string; unit?: string; hint?: string }) {
  return (
    <div className="min-w-0">
      <dt className="text-xs text-ink-muted">{label}</dt>
      <dd className="mt-0.5">
        <span className="text-h3 font-semibold tabular-nums text-ink">{value}</span>
        {unit && <span className="ml-1 text-xs text-ink-muted">{unit}</span>}
        {hint && <span className="block text-xs text-ink-muted">{hint}</span>}
      </dd>
    </div>
  );
}

export function FieldSummarySkeleton() {
  const { t } = useI18n();
  return (
    <div aria-busy="true" aria-live="polite" className="space-y-5">
      <span className="sr-only">{t("state.loading")}</span>
      <SlowHint />
      <Skeleton className="h-6 w-40" />
      <div className="grid grid-cols-2 gap-4">
        {Array.from({ length: 4 }, (_, i) => (
          <div key={i} className="space-y-1.5">
            <Skeleton className="h-3 w-24" />
            <Skeleton className="h-6 w-20" />
          </div>
        ))}
      </div>
      <Skeleton className="h-[200px] w-full" />
      <div className="grid grid-cols-2 gap-4">
        {Array.from({ length: 4 }, (_, i) => (
          <Skeleton key={i} className="h-10 w-full" />
        ))}
      </div>
    </div>
  );
}

export function FieldSummaryError({ message, onRetry }: { message: string; onRetry: () => void }) {
  const { t } = useI18n();
  return <ErrorState title={t("state.error.title")} body={t("state.error.body", { message })} retryLabel={t("state.retry")} onRetry={onRetry} />;
}

export function FieldSummary({ data, field }: { data: FieldAnalysis; field: FieldState }) {
  const { t, n } = useI18n();
  const source = useDataSource();
  const climate = [...data.climate].sort((a, b) => a.year - b.year);
  const from = climate[0]?.year, to = climate[climate.length - 1]?.year;
  const mismatch = source !== "engine" && distanceKm(field, FIXTURE_LOCATION) > 5;
  const ndvi = data.ndvi_history ?? [];
  const ndviMin = ndvi.length ? ndvi.reduce((a, b) => (b.mean_ndvi < a.mean_ndvi ? b : a)) : null;
  const ndviMax = ndvi.length ? ndvi.reduce((a, b) => (b.mean_ndvi > a.mean_ndvi ? b : a)) : null;
  const textureKey = `texture.${data.soil.texture.toLowerCase()}` as MessageKey;
  const texture = t(textureKey) === textureKey ? data.soil.texture : t(textureKey);

  const climateSrc = pickProvenance(data.provenance, /POWER|ERA5|CHIRPS|IMERG|precip|climate|temperature/i);
  const soilSrc = pickProvenance(data.provenance, /soil/i);
  const ndviSrc = pickProvenance(data.provenance, /NDVI|MODIS|VIIRS|vegetation/i);

  return (
    <div className="space-y-5">
      <p aria-live="polite" className="sr-only">{t("live.analysed")}</p>
      {mismatch && (
        <p className="flex gap-2 rounded-md border border-warning bg-warning-bg p-3 text-sm text-warning">
          <Info aria-hidden className="mt-0.5 size-4 shrink-0" strokeWidth={1.5} />
          {t("summary.demoMismatch")}
        </p>
      )}

      {climate.length > 0 && (
        <Section title={t("summary.climate")} sources={<ProvenanceChips items={climateSrc} />}>
          <p className="-mt-1.5 mb-3 text-xs text-ink-muted">{t("summary.climate.period", { from, to })}</p>
          <dl className="grid grid-cols-2 gap-x-4 gap-y-4">
            <Stat label={t("summary.precip")} value={n(mean(climate.map((c) => c.precipitation_mm)))} unit={`${t("unit.mm")} ${t("summary.perYear")}`} />
            <Stat label={t("summary.et0")} value={n(mean(climate.map((c) => c.et0_mm)))} unit={`${t("unit.mm")} ${t("summary.perYear")}`} />
            <Stat label={t("summary.temp")} value={n(mean(climate.map((c) => c.mean_temp_c)), 1)} unit={t("unit.c")} />
            <Stat label={t("summary.wetness")} value={n(mean(climate.map((c) => c.root_zone_wetness)), 2)} hint={t("summary.wetness.hint")} />
          </dl>
          <div className="mt-5">
            <p className="text-sm font-medium text-ink">{t("summary.balance.title")}</p>
            <p className="mb-2 text-xs text-ink-muted">{t("summary.balance.subtitle")}</p>
            <WaterBalanceChart data={climate} />
          </div>
        </Section>
      )}

      <Section title={t("summary.soil")} sources={<ProvenanceChips items={soilSrc} />}>
        <dl className="grid grid-cols-2 gap-x-4 gap-y-4">
          <Stat label={t("summary.texture")} value={texture} />
          <Stat label={t("summary.awc")} value={n(data.soil.awc_mm)} unit={t("unit.mm")} hint={t("summary.awc.hint")} />
          <Stat label={t("summary.oc")} value={n(data.soil.organic_carbon, 1)} unit={t("unit.gkg")} hint={t("summary.oc.hint")} />
          <Stat label={t("summary.ph")} value={n(data.soil.ph, 1)} hint={t("summary.ph.hint")} />
        </dl>
      </Section>

      {ndvi.length > 0 && ndviMin && ndviMax && (
        <Section title={t("summary.ndvi")} sources={<ProvenanceChips items={ndviSrc} />}>
          <dl>
            <Stat
              label={t("summary.ndvi.mean")}
              value={n(mean(ndvi.map((d) => d.mean_ndvi)), 2)}
              hint={t("summary.ndvi.range", { minYear: ndviMin.year, min: n(ndviMin.mean_ndvi, 2), maxYear: ndviMax.year, max: n(ndviMax.mean_ndvi, 2) })}
            />
          </dl>
        </Section>
      )}
      {/* "Changing conditions" panel slots in here once the contract carries climate trend statistics. */}
    </div>
  );
}
