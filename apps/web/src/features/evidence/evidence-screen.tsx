"use client";

import { errorText } from "@/lib/api/errors";

import { SlowHint } from "@/components/ui/slow-hint";
import { FlaskConical, MapPinned } from "lucide-react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useState } from "react";
import { BacktestScatter, BacktestSeries, CorrelationScale } from "@/components/charts/backtest-chart";
import { ProvenanceChips, shortName } from "@/components/ui/provenance-chip";
import { Segmented } from "@/components/ui/segmented";
import { EmptyState, ErrorState, Skeleton } from "@/components/ui/states";
import { useI18n } from "@/i18n";
import type { Validation } from "@/lib/api/types";
import { caveatText, methodText } from "@/lib/localize-engine";
import { useField } from "../field/use-field";
import { MultiSite } from "../landing/landing-extra";
import { ModelVsBaseline } from "./model-vs-baseline";
import { period, useValidation } from "./use-validation";

function readingKey(r: number) {
  if (r < 0) return "evidence.r.negative" as const;
  if (r > 0) return "evidence.r.positive" as const;
  return "evidence.r.zero" as const;
}

function Stats({ v }: { v: Validation }) {
  const { t, n } = useI18n();
  const span = period(v);
  return (
    <section aria-labelledby="stats-title" className="rounded-md border border-border bg-surface p-4 shadow-1 md:p-5">
      <h2 id="stats-title" className="text-xs font-medium text-ink-muted">
        {t("evidence.r.title")}
      </h2>
      <p className="mt-1 text-display font-semibold tabular-nums tracking-[-0.02em] text-ink" data-testid="correlation">
        {t("evidence.r.value", { r: n(v.correlation, 2) })}
      </p>
      <CorrelationScale r={v.correlation} />
      <dl className="mt-4 grid grid-cols-2 gap-3 border-t border-border pt-4 text-sm">
        <div>
          <dt className="text-xs text-ink-muted">{t("evidence.n")}</dt>
          <dd className="font-semibold tabular-nums">{t("evidence.n.value", { n: v.n })}</dd>
        </div>
        {span && (
          <div>
            <dt className="text-xs text-ink-muted">{t("evidence.period")}</dt>
            <dd className="font-semibold tabular-nums">
              {span[0]}–{span[1]}
            </dd>
          </div>
        )}
      </dl>
      <p className="mt-4 text-sm text-ink-2">{t(readingKey(v.correlation))}</p>
      <p className="mt-2 text-xs text-ink-muted">{t("evidence.r.scale")}</p>
    </section>
  );
}

export function EvidenceScreen() {
  const { t, n, locale } = useI18n();
  const { field } = useField();
  const qs = useSearchParams().toString();
  const query = useValidation(field, locale);
  const [view, setView] = useState<"years" | "scatter">("years");
  const [active, setActive] = useState<number | null>(null);
  const [table, setTable] = useState(false);

  if (!field) {
    return (
      <div id="main" tabIndex={-1} className="mx-auto w-full max-w-xl px-4 py-16 md:px-6">
        <EmptyState icon={<MapPinned aria-hidden className="size-6 text-teal-700" strokeWidth={1.5} />} title={t("explore.noField.title")} body={t("evidence.noField.body")}>
          <Link href="/app" className="inline-flex h-11 items-center rounded-md bg-teal-700 px-4 text-sm font-medium text-white hover:bg-teal-600 md:h-10">
            {t("explore.noField.cta")}
          </Link>
        </EmptyState>
      </div>
    );
  }

  const validationResponse = query.data;
  const v = validationResponse?.data;
  const span = v ? period(v) : null;
  const datasets = v ? [...new Set(v.provenance.map(shortName))].join(" + ") : "";
  const subtitle = v && span ? t("evidence.chart.subtitle", { from: span[0], to: span[1], n: v.n, datasets }) : "";
  const cur = v && active !== null ? v.years[active] : null;
  const hasBaseline = !!v?.years.some((y) => y.baseline_index !== undefined);
  const chartLabel = v ? t("evidence.chart.aria", { r: n(v.correlation, 2), n: v.n, from: span?.[0] ?? "", to: span?.[1] ?? "" }) : "";

  return (
    <div className="tv-feature-page mx-auto w-full max-w-[1280px] px-4 pb-16 pt-6 md:px-6 md:pt-8 xl:px-8">
      <div className="tv-page-banner mb-6">
        <span className="tv-banner-eyebrow">{t("evidence.eyebrow")}</span>
        <h1 id="main" tabIndex={-1} className="text-h2 font-semibold tracking-[-0.01em] md:text-h1">
          {t("evidence.title")}
        </h1>
        <p className="mt-1 max-w-[72ch] text-sm text-ink-2 md:text-body">{t("evidence.intro")}</p>
      </div>

      {validationResponse?.fromFixture && (
        <div role="note" data-testid="baseline-note" className="mb-6 flex items-start gap-3 rounded-md border border-warning/30 bg-warning-bg p-4">
          <FlaskConical aria-hidden className="mt-0.5 size-5 shrink-0 text-warning" strokeWidth={1.5} />
          <div className="min-w-0">
            <p className="text-sm font-semibold text-ink">{t("evidence.baseline.title")}</p>
            <p className="mt-1 max-w-[80ch] text-sm text-ink-2">{t("evidence.baseline.body")}</p>
          </div>
        </div>
      )}

      {query.isPending ? (
        <div aria-busy="true" className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
          <span className="sr-only">{t("evidence.loading")}</span>
          <SlowHint className="lg:col-span-2" />
          <div className="order-2 rounded-md border border-border bg-surface p-5 lg:order-1">
            <Skeleton className="h-5 w-2/3" />
            <Skeleton className="mt-2 h-3 w-1/2" />
            <Skeleton className="mt-6 h-[300px]" />
          </div>
          <div className="order-1 rounded-md border border-border bg-surface p-5 lg:order-2">
            <Skeleton className="h-3 w-1/3" />
            <Skeleton className="mt-3 h-12 w-1/2" />
            <Skeleton className="mt-4 h-2" />
            <Skeleton className="mt-6 h-16" />
          </div>
        </div>
      ) : query.isError ? (
        <ErrorState title={t("evidence.error.title")} body={errorText(query.error, t)} retryLabel={t("state.retry")} onRetry={() => query.refetch()} />
      ) : !v || v.years.length === 0 ? (
        <div className="rounded-md border border-border bg-surface p-5">
          <EmptyState title={t("evidence.empty.title")} body={t("evidence.empty.body")} />
        </div>
      ) : (
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px] lg:grid-rows-[auto_1fr] lg:items-start lg:gap-x-8">
          <div className="lg:col-start-2 lg:row-start-1">
            <Stats v={v} />
          </div>
          <div className="min-w-0 space-y-6 lg:col-start-1 lg:row-span-2 lg:row-start-1">
            <section aria-labelledby="chart-title" className="rounded-md border border-border bg-surface p-4 shadow-1 md:p-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <h2 id="chart-title" className="text-h3 font-semibold">
                    {t("evidence.chart.title")}
                  </h2>
                  <p className="mt-0.5 text-xs text-ink-muted">{subtitle}</p>
                </div>
                <Segmented
                  label={t("evidence.view")}
                  hideLabel
                  className="w-full sm:w-auto"
                  value={view}
                  onChange={(x) => setView(x as "years" | "scatter")}
                  options={[
                    { value: "years", label: t("evidence.view.years") },
                    { value: "scatter", label: t("evidence.view.scatter") },
                  ]}
                />
              </div>

              <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-ink-2" aria-hidden>
                {view === "years" ? (
                  <>
                    <span className="inline-flex items-center gap-1.5">
                      <span className="inline-block h-0.5 w-4 rounded-full bg-teal-700" />
                      {t("evidence.legend.stress")}
                    </span>
                    {hasBaseline && (
                      <span className="inline-flex items-center gap-1.5">
                        <span className="inline-block w-4 border-t-2 border-dashed border-[var(--viz-neutral)]" />
                        {t("evidence.legend.baseline")}
                      </span>
                    )}
                    <span className="inline-flex items-center gap-1.5">
                      <span className="inline-block size-2.5 rounded-[2px] bg-[var(--viz-water)]" />
                      {t("evidence.legend.greener")}
                    </span>
                    <span className="inline-flex items-center gap-1.5">
                      <span className="inline-block size-2.5 rounded-[2px] bg-[var(--viz-risk)]" />
                      {t("evidence.legend.browner")}
                    </span>
                  </>
                ) : (
                  <span className="inline-flex items-center gap-1.5">
                    <span className="inline-block size-2.5 rounded-full border-[1.5px] border-ink" />
                    {t("evidence.legend.point")}
                  </span>
                )}
              </div>

              <p aria-live="polite" className="mt-2 min-h-10 text-sm sm:min-h-5 tabular-nums text-ink">
                {cur ? t("evidence.readout", { year: cur.year, stress: n(cur.modelled_stress, 2), anomaly: n(cur.observed_ndvi_anomaly, 2) }) : <span className="text-ink-muted">{t("evidence.readout.hint")}</span>}
              </p>

              <div className="mt-2">
                {view === "years" ? (
                  <BacktestSeries years={v.years} active={active} onActive={setActive} label={chartLabel} />
                ) : (
                  <BacktestScatter years={v.years} active={active} onActive={setActive} label={chartLabel} />
                )}
              </div>

              <button type="button" aria-expanded={table} onClick={() => setTable((x) => !x)} className="mt-2 min-h-6 rounded-sm text-xs font-medium text-teal-700 underline-offset-2 hover:underline">
                {table ? t("summary.table.hide") : t("summary.table.show")}
              </button>
              {table && (
                <div className="mt-2 max-h-96 overflow-auto rounded-md border border-border">
                  <table className="w-full text-sm tabular-nums">
                    <caption className="sr-only">{t("evidence.chart.title")}</caption>
                    <thead className="sticky top-0 bg-sunken text-xs text-ink-2">
                      <tr>
                        <th scope="col" className="px-3 py-1.5 text-left font-medium">{t("chart.axis.year")}</th>
                        <th scope="col" className="px-3 py-1.5 text-right font-medium">{t("evidence.axis.stress")}</th>
                        <th scope="col" className="px-3 py-1.5 text-right font-medium">{t("evidence.axis.anomaly")}</th>
                        {hasBaseline && <th scope="col" className="px-3 py-1.5 text-right font-medium">{t("evidence.axis.baseline")}</th>}
                      </tr>
                    </thead>
                    <tbody>
                      {v.years.map((d) => (
                        <tr key={d.year} className="border-t border-border">
                          <th scope="row" className="px-3 py-1 text-left font-normal">{d.year}</th>
                          <td className="px-3 py-1 text-right">{n(d.modelled_stress, 3)}</td>
                          <td className="px-3 py-1 text-right">{n(d.observed_ndvi_anomaly, 2)}</td>
                          {hasBaseline && <td className="px-3 py-1 text-right">{d.baseline_index === undefined ? "" : n(d.baseline_index, 3)}</td>}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-border pt-3">
                <span className="text-xs text-ink-muted">{t("provenance.label")}</span>
                <ProvenanceChips items={v.provenance} />
              </div>
            </section>

            <ModelVsBaseline v={v} />
            <MultiSite title="evidence.multi.title" />
          </div>

          <aside aria-labelledby="method-title" className="space-y-4 lg:col-start-2 lg:row-start-2">
            <section aria-labelledby="method-title" className="rounded-md border border-border bg-surface p-4 shadow-1 md:p-5">
              <h2 id="method-title" className="text-h3 font-semibold">
                {t("evidence.method")}
              </h2>
              <p className="mt-2 text-sm text-ink-2" data-testid="method">
                {methodText(v.method, locale)}
              </p>
              <h2 className="mt-5 text-h3 font-semibold">{t("evidence.caveats")}</h2>
              {validationResponse.fromFixture && locale === "tr" && <p className="mt-2 text-xs text-warning">{t("demo.englishOnly")}</p>}
              <ul className="mt-2 space-y-2 text-sm text-ink-2" data-testid="caveats" lang={validationResponse.fromFixture ? "en" : undefined}>
                {v.caveats.map((c) => (
                  <li key={c} className="flex gap-2">
                    <span aria-hidden className="mt-2 size-1.5 shrink-0 rounded-full bg-warning" />
                    <span>{caveatText(c, v, locale, n)}</span>
                  </li>
                ))}
              </ul>
            </section>
            <Link href={`/app/explore?${qs}`} className="inline-flex text-sm font-medium text-teal-700 underline-offset-2 hover:underline">
              {t("evidence.toExplore")}
            </Link>
          </aside>
        </div>
      )}
    </div>
  );
}
