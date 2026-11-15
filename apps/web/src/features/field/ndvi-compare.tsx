"use client";

import { ProvenanceChips } from "@/components/ui/provenance-chip";
import { SlowHint } from "@/components/ui/slow-hint";
import { ErrorState, Skeleton } from "@/components/ui/states";
import { useI18n } from "@/i18n";
import { FIXTURE_LOCATION } from "@/lib/api/mock";
import type { NdviYear } from "@/lib/api/types";
import { distanceKm } from "@/lib/geo";
import type { FieldState } from "@/lib/url-state";
import { useFieldNdvi } from "./use-field";

/**
 * Field-scale (30 m, HLS) growing-season NDVI next to the 250 m MODIS record for the same years. The two describe
 * different areas, so they are shown side by side and never merged or rescaled.
 */
export function NdviCompare({ field, modis }: { field: FieldState; modis: NdviYear[] }) {
  const { t, n } = useI18n();
  const q = useFieldNdvi(field);

  if (q.isPending) {
    return (
      <div aria-busy="true" className="mt-4 space-y-2">
        <span className="sr-only">{t("ndvi30.loading")}</span>
        <SlowHint />
        <Skeleton className="h-4 w-48" />
        <Skeleton className="h-28 w-full" />
      </div>
    );
  }
  if (q.isError) {
    return (
      <div className="mt-4">
        <ErrorState title={t("ndvi30.error")} body={t("state.error.body", { message: q.error.message })} retryLabel={t("state.retry")} onRetry={() => q.refetch()} />
      </div>
    );
  }

  const { data, fromFixture } = q.data;
  const modisByYear = new Map(modis.map((d) => [d.year, d.mean_ndvi]));
  const demoElsewhere = fromFixture && distanceKm(field, FIXTURE_LOCATION) > 5;

  return (
    <div className="mt-5" data-testid="ndvi30">
      <h4 className="text-xs font-semibold text-ink">{t("ndvi30.title")}</h4>
      <p className="mt-1 text-xs text-ink-2">{t("ndvi30.why")}</p>
      {fromFixture && <p className="mt-1 text-xs text-warning">{demoElsewhere ? t("ndvi30.demoElsewhere") : t("ndvi30.demo")}</p>}

      {data.seasons.length === 0 ? (
        <p className="mt-2 text-sm text-ink-2">{t("ndvi30.empty")}</p>
      ) : (
        <div className="mt-2 overflow-x-auto rounded-md border border-border">
          <table className="w-full text-sm tabular-nums">
            <caption className="sr-only">{t("ndvi30.title")}</caption>
            <thead className="bg-sunken text-xs text-ink-2">
              <tr>
                <th scope="col" className="px-3 py-1.5 text-left font-medium">{t("chart.axis.year")}</th>
                <th scope="col" className="px-3 py-1.5 text-right font-medium">{t("ndvi30.col.modis")}</th>
                <th scope="col" className="px-3 py-1.5 text-right font-medium">{t("ndvi30.col.hls")}</th>
                <th scope="col" className="px-3 py-1.5 text-right font-medium">{t("ndvi30.col.clear")}</th>
              </tr>
            </thead>
            <tbody>
              {data.seasons.map((s) => {
                const m = modisByYear.get(s.year);
                return (
                  <tr key={s.year} className="border-t border-border">
                    <th scope="row" className="px-3 py-1 text-left font-normal">{s.year}</th>
                    <td className="px-3 py-1 text-right">{m === undefined ? <span className="text-ink-muted">{t("ndvi30.none")}</span> : n(m, 2)}</td>
                    <td className="px-3 py-1 text-right font-semibold">
                      {s.mean_ndvi === undefined || s.mean_ndvi === null ? <span className="font-normal text-ink-muted">{t("ndvi30.tooFew")}</span> : n(s.mean_ndvi, 2)}
                    </td>
                    <td className="px-3 py-1 text-right text-ink-2">{t("ndvi30.clearOf", { clear: s.n_clear, scenes: s.n_scenes })}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {data.caveats.length > 0 && (
        <ul lang="en" className="mt-2 space-y-1 text-xs text-ink-muted">
          {data.caveats.map((c) => (
            <li key={c} className="flex gap-2">
              <span aria-hidden className="mt-1.5 size-1 shrink-0 rounded-full bg-warning" />
              <span>{c}</span>
            </li>
          ))}
        </ul>
      )}
      <div className="mt-2">
        <ProvenanceChips items={data.provenance} />
      </div>
    </div>
  );
}
