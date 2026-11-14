"use client";

import { SlowHint } from "@/components/ui/slow-hint";
import { Columns2, Loader2, MapPinned, RotateCcw } from "lucide-react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useMemo, useState } from "react";
import { pickProvenance, ProvenanceChips } from "@/components/ui/provenance-chip";
import { Segmented } from "@/components/ui/segmented";
import { Slider } from "@/components/ui/slider";
import { EmptyState, ErrorState, Skeleton } from "@/components/ui/states";
import { useI18n, type MessageKey } from "@/i18n";
import { FIXTURE_HORIZON } from "@/lib/api/mock";
import { useDataSource } from "@/lib/api/source";
import type { Crop } from "@/lib/api/types";
import { polygonAreaM2 } from "@/lib/geo";
import { DEFAULT_PRIORITIES, HORIZONS, OBJECTIVES, type Horizon } from "@/lib/priorities";
import { useField } from "../field/use-field";
import { CompareDialog } from "./compare-dialog";
import { cropName } from "./crop-timeline";
import { RotationCard, rotationKey } from "./rotation-card";
import { OBJECTIVE_COLOR } from "./score-bars";
import { useCrops, useExploreParams, useRotations } from "./use-explore";

function CardSkeleton() {
  return (
    <div className="rounded-md border border-border bg-surface p-5">
      <div className="flex items-center gap-3">
        <Skeleton className="size-8 rounded-full" />
        <Skeleton className="h-4 flex-1" />
        <Skeleton className="h-6 w-10" />
      </div>
      <div className="mt-4 grid grid-cols-4 gap-2">
        {Array.from({ length: 4 }, (_, i) => (
          <Skeleton key={i} className="h-14" />
        ))}
      </div>
      <div className="mt-4 space-y-2.5">
        {Array.from({ length: 4 }, (_, i) => (
          <Skeleton key={i} className="h-2.5" />
        ))}
      </div>
    </div>
  );
}

export function ExploreScreen() {
  const { t, n } = useI18n();
  const { field } = useField();
  const fieldQs = `?${useSearchParams().toString()}`;
  const source = useDataSource();
  const { priorities, debounced, horizon, setPriority, setAll, setHorizon } = useExploreParams();
  const demo = source !== "engine";
  const effectiveHorizon: Horizon = demo ? (FIXTURE_HORIZON as Horizon) : horizon;
  const rotations = useRotations(field, debounced, effectiveHorizon);
  const crops = useCrops();
  const cropMap = useMemo(() => (crops.data ? new Map<string, Crop>(crops.data.map((c) => [c.id, c])) : undefined), [crops.data]);
  const [selected, setSelected] = useState<string[]>([]);
  const [compareOpen, setCompareOpen] = useState(false);

  const list = rotations.data?.rotations;
  const top = list?.[0];
  const announce = top ? t("explore.live", { sequence: top.sequence.map((c) => cropName(c, cropMap)).join(", ") }) : "";

  // Drop selections that are no longer in the list (e.g. after a horizon change).
  const keys = useMemo(() => new Set(list?.map(rotationKey)), [list]);
  const activeSel = selected.filter((k) => keys.has(k));
  const pair = activeSel.length === 2 && list ? (activeSel.map((k) => list.find((r) => rotationKey(r) === k)!) as [NonNullable<typeof top>, NonNullable<typeof top>]) : null;
  const ranks: [number, number] = pair && list ? [list.indexOf(pair[0]) + 1, list.indexOf(pair[1]) + 1] : [0, 0];

  const toggle = (k: string) => setSelected((s) => (s.includes(k) ? s.filter((x) => x !== k) : [...s.filter((x) => keys.has(x)), k].slice(-2)));

  if (!field) {
    return (
      <div id="main" tabIndex={-1} className="mx-auto w-full max-w-xl px-4 py-16 md:px-6">
        <EmptyState icon={<MapPinned aria-hidden className="size-6 text-teal-700" strokeWidth={1.5} />} title={t("explore.noField.title")} body={t("explore.noField.body")}>
          <Link href="/app" className="inline-flex h-11 items-center rounded-md bg-teal-700 px-4 text-sm font-medium text-white hover:bg-teal-600 md:h-10">
            {t("explore.noField.cta")}
          </Link>
        </EmptyState>
      </div>
    );
  }

  const area = field.ring ? polygonAreaM2(field.ring) / 10_000 : null;
  const isDefault = OBJECTIVES.every((k) => priorities[k] === DEFAULT_PRIORITIES[k]);

  return (
    <div className="mx-auto w-full max-w-[1280px] px-4 pt-6 md:px-6 md:pt-8 xl:px-8">
      <div className="mb-6">
        <h1 id="main" tabIndex={-1} className="text-h2 font-semibold tracking-[-0.01em] md:text-h1">
          {t("explore.title")}
        </h1>
        <p className="mt-1 max-w-[72ch] text-sm text-ink-2 md:text-body">{t("explore.intro")}</p>
      </div>

      <div className="grid gap-6 lg:grid-cols-[340px_minmax(0,1fr)] lg:gap-8">
        {/* Controls */}
        <aside aria-label={t("explore.priorities")} className="space-y-4 lg:sticky lg:top-6 lg:self-start">
          <section className="rounded-md border border-border bg-surface p-4 shadow-1 md:p-5">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <h2 className="text-xs font-medium text-ink-muted">{t("explore.field")}</h2>
                <p className="mt-0.5 text-sm font-medium tabular-nums text-ink">
                  {n(Math.abs(field.lat), 4)}° {field.lat >= 0 ? "N" : "S"}, {n(Math.abs(field.lon), 4)}° {field.lon >= 0 ? "E" : "W"}
                </p>
                <p className="text-xs text-ink-2">
                  {area !== null && `${n(area, 2)} ${t("unit.ha")} · `}
                  {field.irrigated ? t("explore.field.irrigated") : t("explore.field.rainfed")}
                </p>
              </div>
              <Link href={`/app${fieldQs}`} className="shrink-0 rounded-sm text-sm font-medium text-teal-700 underline-offset-2 hover:underline">
                {t("explore.field.change")}
              </Link>
            </div>
          </section>

          <section aria-labelledby="prio-title" className="rounded-md border border-border bg-surface p-4 shadow-1 md:p-5">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 id="prio-title" className="text-h3 font-semibold">
                  {t("explore.priorities")}
                </h2>
                <p className="mt-0.5 text-xs text-ink-muted">{t("explore.priorities.hint")}</p>
              </div>
              <button
                type="button"
                onClick={() => setAll(DEFAULT_PRIORITIES)}
                disabled={isDefault}
                className="inline-flex min-h-9 shrink-0 items-center gap-1 rounded-md px-2 text-xs font-medium text-teal-700 hover:bg-teal-100 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <RotateCcw aria-hidden className="size-3.5" strokeWidth={1.5} />
                {t("explore.reset")}
              </button>
            </div>
            <div className="mt-3 space-y-3">
              {OBJECTIVES.map((k) => (
                <Slider
                  key={k}
                  label={t(`explore.priority.${k}` as MessageKey)}
                  description={t(`explore.priority.${k}.desc` as MessageKey)}
                  value={priorities[k]}
                  valueText={t("explore.priority.value", { value: Math.round(priorities[k] * 100) })}
                  onChange={(v) => setPriority(k, v)}
                  color={OBJECTIVE_COLOR[k]}
                />
              ))}
            </div>
            <div className="mt-5 border-t border-border pt-4">
              <Segmented
                label={t("explore.horizon")}
                value={String(effectiveHorizon)}
                onChange={(v) => !demo && setHorizon(Number(v) as Horizon)}
                options={HORIZONS.map((h) => ({ value: String(h), label: t("explore.horizon.years", { n: h }) }))}
              />
              {demo && <p className="mt-1.5 text-xs text-warning">{t("explore.horizon.demoOnly", { n: FIXTURE_HORIZON })}</p>}
            </div>
          </section>
        </aside>

        {/* Results */}
        <section aria-labelledby="results-title" aria-busy={rotations.isFetching} className="min-w-0">
          <div className="mb-3 flex flex-wrap items-end justify-between gap-x-4 gap-y-2">
            <div>
              <h2 id="results-title" className="text-h3 font-semibold">
                {t("explore.results")}
              </h2>
              {list && <p className="text-xs text-ink-muted">{t("explore.results.count", { count: list.length })}</p>}
            </div>
            <div className="flex items-center gap-3">
              {rotations.isFetching && rotations.data && (
                <span className="inline-flex items-center gap-1.5 text-xs text-ink-muted">
                  <Loader2 aria-hidden className="size-3.5 animate-spin" strokeWidth={1.5} />
                  {t("explore.updating")}
                </span>
              )}
              {rotations.data && <ProvenanceChips items={pickProvenance(rotations.data.provenance, /.*/)} />}
            </div>
          </div>
          <p className="mb-4 max-w-[72ch] text-xs text-ink-2">{t("explore.results.note")}</p>
          <p aria-live="polite" className="sr-only">
            {announce}
          </p>
          {crops.isError && <p className="mb-3 text-xs text-warning">{t("explore.crops.error")}</p>}

          {/* Trade-off scatter view for the Pareto set slots in here once the contract carries it. */}

          {rotations.isPending ? (
            <div aria-busy="true" className="space-y-4">
              <span className="sr-only">{t("explore.loading")}</span>
              <SlowHint />
              <CardSkeleton />
              <CardSkeleton />
              <CardSkeleton />
            </div>
          ) : rotations.isError ? (
            <ErrorState title={t("explore.error.title")} body={t("state.error.body", { message: rotations.error.message })} retryLabel={t("state.retry")} onRetry={() => rotations.refetch()} />
          ) : !list || list.length === 0 ? (
            <div className="rounded-md border border-border bg-surface p-5">
              <EmptyState title={t("explore.empty.title")} body={t("explore.empty.body")} />
            </div>
          ) : (
            <ol className={`space-y-4 transition-opacity duration-[var(--dur-base)] ${rotations.isPlaceholderData ? "opacity-60" : ""}`}>
              {list.map((r, i) => (
                <li key={rotationKey(r)}>
                  <RotationCard
                    rotation={r}
                    rank={i + 1}
                    crops={cropMap}
                    irrigated={field.irrigated}
                    selected={activeSel.includes(rotationKey(r))}
                    selectDisabled={activeSel.length >= 2}
                    onToggleSelect={() => toggle(rotationKey(r))}
                  />
                </li>
              ))}
            </ol>
          )}
        </section>
      </div>

      {/* Compare tray: sticky inside the screen so it follows the viewport but never covers the site footer. */}
      {list && list.length > 1 ? (
        <div className="sticky bottom-0 z-20 -mx-4 mt-8 border-t border-border bg-surface/95 px-4 py-3 shadow-3 backdrop-blur-sm md:-mx-6 md:px-6 xl:-mx-8 xl:px-8" role="region" aria-label={t("explore.compare.title")}>
          <div className="mx-auto flex max-w-[1280px] flex-wrap items-center gap-3">
            <Columns2 aria-hidden className="hidden size-5 text-ink-muted sm:block" strokeWidth={1.5} />
            <p className="mr-auto text-sm text-ink-2" aria-live="polite">
              {activeSel.length === 0 ? t("explore.compare.hint") : t("explore.compare.selected", { count: activeSel.length })}
            </p>
            {activeSel.length > 0 && (
              <button type="button" onClick={() => setSelected([])} className="min-h-10 rounded-md px-3 text-sm font-medium text-teal-700 hover:bg-teal-100">
                {t("explore.compare.clear")}
              </button>
            )}
            <button
              type="button"
              disabled={!pair}
              onClick={() => setCompareOpen(true)}
              className="inline-flex h-10 items-center gap-2 rounded-md bg-teal-700 px-4 text-sm font-medium text-white hover:bg-teal-600 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {t("explore.compare.open")}
            </button>
          </div>
        </div>
      ) : (
        <div className="h-16" />
      )}

      <CompareDialog open={compareOpen && !!pair} onClose={() => setCompareOpen(false)} pair={pair} ranks={ranks} crops={cropMap} irrigated={field.irrigated} />
    </div>
  );
}
