"use client";

import { cropLabel } from "@/lib/localize-engine";

import { CheckCircle2, ExternalLink, Loader2, MapPinned, TriangleAlert } from "lucide-react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { shortName } from "@/components/ui/provenance-chip";
import { Skeleton } from "@/components/ui/states";
import { useI18n, type MessageKey } from "@/i18n";
import { FIXTURE_HORIZON } from "@/lib/api/mock";
import { useDataSource } from "@/lib/api/source";
import type { Provenance } from "@/lib/api/types";
import { parseExplore, type Horizon } from "@/lib/priorities";
import { useCrops, useRotations } from "../explore/use-explore";
import { useValidation } from "../evidence/use-validation";
import { useField, useFieldAnalysis, useFieldNdvi } from "../field/use-field";
import { useHazards } from "../field/use-hazards";

type Screen = "field" | "explore" | "evidence";

interface RequestState {
  key: MessageKey;
  screen: Screen;
  status: "pending" | "error" | "ok";
  demo: boolean;
  provenance: Provenance[];
  retry: () => void;
}

/** Map and search services drawn on screen. Attribution text matches the map's own attribution control. */
const MAP_SOURCES = [
  { name: "data.map.src.vector", data: "OpenStreetMap contributors", use: "data.map.vector", url: "https://openfreemap.org" },
  { name: "data.map.src.satellite", data: "Esri, Maxar, Earthstar Geographics; or EOX IT Services GmbH, contains modified Copernicus Sentinel data 2016 (CC BY 4.0)", use: "data.map.satellite", url: "https://cloudless.eox.at" },
  { name: "data.map.src.search", data: "komoot; OpenStreetMap contributors", use: "data.map.search", url: "https://photon.komoot.io" },
] as const;

function StatusRow({ r }: { r: RequestState }) {
  const { t } = useI18n();
  return (
    <li className="flex flex-wrap items-center gap-x-3 gap-y-1 py-2.5">
      {r.status === "pending" ? (
        <Loader2 aria-hidden className="size-4 animate-spin text-ink-muted" strokeWidth={1.5} />
      ) : r.status === "error" ? (
        <TriangleAlert aria-hidden className="size-4 text-danger" strokeWidth={1.5} />
      ) : (
        <CheckCircle2 aria-hidden className={`size-4 ${r.demo ? "text-warning" : "text-teal-700"}`} strokeWidth={1.5} />
      )}
      <span className="min-w-0 flex-1 text-sm text-ink">{t(r.key)}</span>
      <span className={`text-xs ${r.status === "error" ? "text-danger" : r.demo ? "text-warning" : "text-ink-2"}`}>
        {r.status === "pending" ? t("data.status.loading") : r.status === "error" ? t("data.status.error") : r.demo ? t("data.status.demo") : t("data.status.live")}
      </span>
      {r.status === "error" && (
        <button type="button" onClick={r.retry} className="min-h-8 rounded-md px-2 text-xs font-medium text-teal-700 hover:bg-teal-100">
          {t("state.retry")}
        </button>
      )}
    </li>
  );
}

function DatasetCard({ p, screens }: { p: Provenance; screens: Screen[] }) {
  const { t } = useI18n();
  return (
    <article className="rounded-md border border-border bg-surface p-4 shadow-1 md:p-5">
      <p className="text-xs font-medium text-ink-muted" data-proper-name>{shortName(p)}</p>
      <h3 className="mt-0.5 text-sm font-semibold text-ink" data-proper-name>{p.dataset}</h3>
      <dl className="mt-3 grid grid-cols-1 gap-x-4 gap-y-2 text-sm sm:grid-cols-[9rem_1fr]">
        <dt className="text-xs text-ink-muted sm:pt-0.5">{t("provenance.provider")}</dt>
        <dd className="text-ink-2" data-proper-name>{p.provider}</dd>
        <dt className="text-xs text-ink-muted sm:pt-0.5">{t("provenance.resolution")}</dt>
        <dd className="text-ink-2" data-engine-text>{p.spatial_resolution}</dd>
        <dt className="text-xs text-ink-muted sm:pt-0.5">{t("provenance.coverage")}</dt>
        <dd className="text-ink-2" data-engine-text>{p.temporal_coverage}</dd>
        <dt className="text-xs text-ink-muted sm:pt-0.5">{t("data.usedIn")}</dt>
        <dd className="flex flex-wrap gap-1.5">
          {screens.map((s) => (
            <span key={s} className="rounded-sm bg-sunken px-1.5 py-0.5 text-xs font-medium text-ink-2">
              {t(`nav.${s === "field" ? "field" : s}` as MessageKey)}
            </span>
          ))}
        </dd>
        {p.note && (
          <>
            <dt className="text-xs text-ink-muted sm:pt-0.5">{t("provenance.note")}</dt>
            <dd lang="en" className="text-xs leading-5 text-ink-2" data-engine-text>
              {p.note}
            </dd>
          </>
        )}
      </dl>
      <a href={p.access_url} target="_blank" rel="noreferrer" className="mt-3 inline-flex items-center gap-1 text-sm font-medium text-teal-700 underline-offset-2 hover:underline">
        {t("provenance.link")}
        <ExternalLink aria-hidden className="size-3.5" strokeWidth={1.5} />
        <span className="sr-only" data-proper-name>: {p.dataset}</span>
      </a>
    </article>
  );
}

/** Every dataset behind what the app shows for the current field, as returned in each response's provenance. */
export function DataScreen() {
  const { t, locale } = useI18n();
  const params = useSearchParams();
  const { field } = useField();
  const source = useDataSource();
  const explore = parseExplore(new URLSearchParams(params.toString()));
  const horizon: Horizon = source === "engine" ? explore.horizon : (FIXTURE_HORIZON as Horizon);

  const analysis = useFieldAnalysis(field);
  const rotations = useRotations(field, explore.priorities, horizon, [], locale);
  const validation = useValidation(field, locale);
  const ndvi30 = useFieldNdvi(field);
  const hazards = useHazards(field);
  const crops = useCrops();

  const status = (q: { isPending: boolean; isError: boolean }) => (q.isPending ? "pending" : q.isError ? "error" : "ok") as RequestState["status"];
  const requests: RequestState[] = field
    ? [
        { key: "data.req.field", screen: "field", status: status(analysis), demo: source !== "engine", provenance: analysis.data?.provenance ?? [], retry: () => analysis.refetch() },
        { key: "data.req.ndvi30", screen: "field", status: status(ndvi30), demo: !!ndvi30.data?.fromFixture, provenance: ndvi30.data?.data.provenance ?? [], retry: () => ndvi30.refetch() },
        { key: "data.req.rotations", screen: "explore", status: status(rotations), demo: source !== "engine", provenance: rotations.data?.provenance ?? [], retry: () => rotations.refetch() },
        { key: "data.req.hazards", screen: "field", status: status(hazards), demo: !!hazards.data?.fromFixture, provenance: hazards.data?.data.provenance ?? [], retry: () => hazards.refetch() },
        { key: "data.req.validation", screen: "evidence", status: status(validation), demo: !!validation.data?.fromFixture, provenance: validation.data?.data.provenance ?? [], retry: () => validation.refetch() },
      ]
    : [];

  // Deduplicate by dataset name; remember every screen that uses it.
  const datasets = new Map<string, { p: Provenance; screens: Set<Screen> }>();
  for (const r of requests)
    for (const p of r.provenance) {
      const hit = datasets.get(p.dataset) ?? { p, screens: new Set<Screen>() };
      hit.screens.add(r.screen);
      datasets.set(p.dataset, hit);
    }
  const anyPending = requests.some((r) => r.status === "pending");
  const qs = params.toString();

  return (
    <div className="tv-feature-page mx-auto w-full max-w-[1280px] px-4 pb-16 pt-6 md:px-6 md:pt-8 xl:px-8">
      <div className="tv-page-banner mb-6">
        <span className="tv-banner-eyebrow">{t("data.eyebrow")}</span>
        <h1 id="main" tabIndex={-1} className="text-h2 font-semibold tracking-[-0.01em] md:text-h1">
          {t("data.title")}
        </h1>
        <p className="mt-1 max-w-[72ch] text-sm md:text-body">{t("data.intro")}</p>
      </div>

      {!field ? (
        <div className="tv-card rounded-md border border-border bg-surface p-5">
          <div className="flex items-start gap-3">
            <MapPinned aria-hidden className="mt-0.5 size-5 shrink-0 text-teal-700" strokeWidth={1.5} />
            <div>
              <p className="text-sm font-semibold text-ink">{t("data.noField.title")}</p>
              <p className="mt-1 text-sm text-ink-2">{t("data.noField.body")}</p>
              <Link href="/app" className="mt-3 inline-flex h-10 items-center rounded-md bg-teal-700 px-4 text-sm font-medium text-white hover:bg-teal-600">
                {t("explore.noField.cta")}
              </Link>
            </div>
          </div>
        </div>
      ) : (
        <div className="grid gap-6 lg:grid-cols-[360px_minmax(0,1fr)]">
          <section aria-labelledby="requests-title" className="tv-card self-start rounded-md border border-border bg-surface px-4 py-2 md:px-5 lg:sticky lg:top-6">
            <h2 id="requests-title" className="pt-2 text-h3 font-semibold">
              {t("data.requests")}
            </h2>
            <ul aria-live="polite" className="divide-y divide-border">
              {requests.map((r) => (
                <StatusRow key={r.key} r={r} />
              ))}
            </ul>
          </section>

          <section aria-labelledby="datasets-title">
            <h2 id="datasets-title" className="text-h3 font-semibold">
              {t("data.datasets", { count: datasets.size })}
            </h2>
            <p className="mt-1 text-xs text-ink-muted">{t("data.datasets.hint")}</p>
            {locale !== "en" && <p className="mt-1 text-xs text-ink-muted">{t("data.language")}</p>}
            <div className="mt-3 grid gap-4">
              {[...datasets.values()].map(({ p, screens }) => (
                <DatasetCard key={p.dataset} p={p} screens={[...screens]} />
              ))}
              {anyPending && datasets.size === 0 && (
                <div aria-hidden className="space-y-4">
                  <Skeleton className="h-40 w-full" />
                  <Skeleton className="h-40 w-full" />
                </div>
              )}
            </div>
          </section>
        </div>
      )}

      {crops.data && crops.data.length > 0 && (
        <section aria-labelledby="crops-title" className="tv-card mt-8 rounded-md border border-border bg-surface p-4 md:p-5">
          <h2 id="crops-title" className="text-h3 font-semibold">
            {t("data.crops")}
          </h2>
          <p className="mt-1 text-xs text-ink-muted">{t("data.crops.hint")}</p>
          <div className="mt-3 overflow-x-auto rounded-md border border-border bg-surface">
            <table className="w-full text-sm">
              <thead className="bg-sunken text-xs text-ink-2">
                <tr>
                  <th scope="col" className="px-3 py-2 text-left font-medium">{t("chart.table.crop")}</th>
                  <th scope="col" className="px-3 py-2 text-left font-medium">{t("data.crops.source")}</th>
                </tr>
              </thead>
              <tbody>
                {crops.data.map((c) => (
                  <tr key={c.id} className="border-t border-border align-top">
                    <th scope="row" className="whitespace-nowrap px-3 py-2 text-left font-medium text-ink">{cropLabel(c.id, c.name, locale)}</th>
                    <td lang="en" className="px-3 py-2 text-xs leading-5 text-ink-2">{c.source}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      <section aria-labelledby="map-title" className="tv-card mt-8 rounded-md border border-border bg-surface p-4 md:p-5">
        <h2 id="map-title" className="text-h3 font-semibold">
          {t("data.map")}
        </h2>
        <ul className="mt-3 divide-y divide-border rounded-md border border-border bg-surface">
          {MAP_SOURCES.map((m) => (
            <li key={m.name} className="flex flex-col gap-1 px-4 py-3 sm:flex-row sm:items-baseline sm:gap-4">
              <span className="text-sm font-medium text-ink sm:w-72 sm:shrink-0">{t(m.name as MessageKey)}</span>
              <span className="flex-1 text-xs text-ink-2">
                {t(m.use as MessageKey)} · <span data-proper-name>{m.data}</span>
              </span>
              <a href={m.url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-xs font-medium text-teal-700 underline-offset-2 hover:underline">
                {m.url.replace("https://", "")}
                <ExternalLink aria-hidden className="size-3" strokeWidth={1.5} />
              </a>
            </li>
          ))}
        </ul>
      </section>

      <p className="mt-8 text-sm">
        <Link href={`/app${qs ? `?${qs}` : ""}`} className="font-medium text-teal-700 underline-offset-2 hover:underline">
          {t("data.back")}
        </Link>
      </p>
    </div>
  );
}
