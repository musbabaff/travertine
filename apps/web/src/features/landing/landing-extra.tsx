"use client";

import { ArrowRight } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { Slider } from "@/components/ui/slider";
import { useI18n, type MessageKey } from "@/i18n";
import { useShowcase } from "../showcase/use-showcase";
import { DEMO_FIELD, FIXTURE_HORIZON } from "@/lib/api/mock";
import { useDataSource } from "@/lib/api/source";
import type { Crop } from "@/lib/api/types";
import { type LngLat } from "@/lib/geo";
import { DEFAULT_PRIORITIES, type Horizon } from "@/lib/priorities";
import type { FieldState } from "@/lib/url-state";
import { cropName } from "../explore/crop-timeline";
import { useCrops, useRotations } from "../explore/use-explore";

const demoField: FieldState = {
  lat: DEMO_FIELD.lat,
  lon: DEMO_FIELD.lon,
  ring: DEMO_FIELD.geometry.coordinates[0].slice(0, -1) as LngLat[],
  irrigated: DEMO_FIELD.irrigated,
};

function Section({ id, title, children }: { id: string; title: string; children: React.ReactNode }) {
  return (
    <section aria-labelledby={id} className="border-t border-border py-12 md:py-16">
      <h2 id={id} className="text-h2 font-semibold tracking-[-0.01em]">
        {title}
      </h2>
      {children}
    </section>
  );
}

/** Moving one priority re-ranks the engine's rotations for the demo field. */
export function LiveDemo({ demoHref }: { demoHref: string }) {
  const { t, locale } = useI18n();
  const source = useDataSource();
  const [water, setWater] = useState(0.5);
  const horizon = (source === "engine" ? 4 : FIXTURE_HORIZON) as Horizon;
  const rotations = useRotations(demoField, { ...DEFAULT_PRIORITIES, water }, horizon, [], locale);
  const crops = useCrops();
  const map = crops.data ? new Map<string, Crop>(crops.data.map((c) => [c.id, c])) : undefined;
  const top = rotations.data?.rotations[0];
  return (
    <div className="tv-landing-demo" aria-labelledby="live-demo">
      <h2 id="live-demo" className="text-h3 font-semibold text-ink">
        {t("landing.demo.title")}
      </h2>
      <p className="mt-1 text-sm text-ink-2">{t("landing.demo.body")}</p>
      <div className="mt-4">
        <Slider label={t("explore.priority.water")} description={t("explore.priority.water.desc")} value={water} valueText={t("explore.priority.value", { value: Math.round(water * 100) })} onChange={setWater} color="var(--viz-water)" />
      </div>
      <div aria-live="polite" className="mt-4 rounded-md bg-sunken p-4">
        <p className="text-xs text-ink-muted">{t("landing.demo.top")}</p>
        <p className={`mt-1 text-h3 font-semibold text-ink ${rotations.isFetching ? "opacity-60" : ""}`} data-testid="demo-top">
          {top ? top.sequence.map((c) => cropName(c, map, locale)).join(" → ") : rotations.isError ? t("explore.error.title") : t("overview.loading")}
        </p>
        {top && <p className="mt-1 text-xs tabular-nums text-ink-2">{t("landing.demo.score", { total: Math.round(top.scores.total * 100) })}</p>}
        {source !== "engine" && <p className="mt-1 text-xs text-warning">{t("source.demo")}</p>}
      </div>
      <Link href={demoHref.replace("/app?", "/app/explore?")} className="mt-3 inline-flex items-center gap-1 text-sm font-medium text-teal-700 underline-offset-2 hover:underline">
        {t("landing.demo.more")} <ArrowRight aria-hidden className="size-4" />
      </Link>
    </div>
  );
}

export function CurrentEntry({ demoHref }: { demoHref: string }) {
  const { t } = useI18n();
  return (
    <Section id="grow-now" title={t("current.title")}>
      <p className="mt-2 max-w-[70ch] text-body text-ink-2">{t("landing.current.body")}</p>
      <Link href={demoHref.replace("/app?", "/app/explore?")} className="mt-4 inline-flex h-11 items-center gap-2 rounded-md bg-teal-700 px-5 text-sm font-medium text-white hover:bg-teal-600">
        {t("landing.current.cta")} <ArrowRight aria-hidden className="size-4" />
      </Link>
    </Section>
  );
}

/** Multi-site back-test and showcase fields, shown only when the live engine serves /v1/showcase. */
export function MultiSite({ title }: { title?: MessageKey } = {}) {
  const { t, n } = useI18n();
  const q = useShowcase();
  if (!q.data || q.data.fromFixture) return null;
  const { fields, pooled } = q.data.data;
  const verdict = (v?: string) => (v ? t(`evidence.verdict.${v}` as MessageKey) : "");
  return (
    <Section id="multisite" title={t(title ?? "landing.multi.title")}>
      <p className="mt-2 max-w-[70ch] text-sm text-ink-2">{t("landing.multi.body")}</p>
      {pooled && (
        <p className="mt-4 rounded-md border border-border bg-surface p-4 text-sm text-ink" data-testid="pooled">
          {t("landing.multi.pooled", { sites: pooled.sites, r: n(pooled.mean_correlation, 2), b: n(pooled.mean_baseline_correlation, 2), lo: n(pooled.mean_difference_ci95[0], 2), hi: n(pooled.mean_difference_ci95[1], 2) })}{" "}
          <strong>{verdict(pooled.verdict)}</strong>
        </p>
      )}
      <div className="mt-4 overflow-x-auto rounded-md border border-border bg-surface">
        <table className="w-full text-sm tabular-nums">
          <thead className="bg-sunken text-xs text-ink-2">
            <tr>
              <th scope="col" className="px-3 py-2 text-left font-medium">{t("landing.multi.site")}</th>
              <th scope="col" className="px-3 py-2 text-right font-medium">{t("evidence.compare.model")}</th>
              <th scope="col" className="px-3 py-2 text-right font-medium">{t("landing.evidence.baseline")}</th>
              <th scope="col" className="px-3 py-2 text-left font-medium">{t("evidence.compare.verdict")}</th>
            </tr>
          </thead>
          <tbody>
            {fields.map((f) => (
              <tr key={f.id} className="border-t border-border align-top">
                <th scope="row" className="px-3 py-2 text-left font-medium">
                  <Link href={`/app?lat=${f.lat}&lon=${f.lon}`} className="text-teal-700 underline-offset-2 hover:underline">
                    {f.name}
                  </Link>
                </th>
                {f.validation.status === "ok" ? (
                  <>
                    <td className="px-3 py-2 text-right">
                      {n(f.validation.correlation!, 2)} <span className="text-xs text-ink-muted">[{n(f.validation.correlation_ci95![0], 2)}, {n(f.validation.correlation_ci95![1], 2)}]</span>
                    </td>
                    <td className="px-3 py-2 text-right">{n(f.validation.baseline_correlation!, 2)}</td>
                    <td className="px-3 py-2 text-xs text-ink-2">{verdict(f.validation.verdict)}</td>
                  </>
                ) : (
                  <td colSpan={3} className="px-3 py-2 text-xs text-ink-muted" lang="en">
                    {f.validation.reason}
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Section>
  );
}

const CHALLENGE = ["data", "local", "priorities", "strategies", "explain", "limits"] as const;
const GLOSSARY = ["et", "smAnomaly", "ndvi", "frost", "waterBalance", "satellite"] as const;
const ROADMAP = ["plan", "scenarios", "hazards", "inputs", "trends"] as const;

export function ChallengeMap() {
  const { t } = useI18n();
  return (
    <Section id="challenge" title={t("landing.challenge.title")}>
      <dl className="mt-6 grid gap-4 md:grid-cols-2">
        {CHALLENGE.map((k) => (
          <div key={k} className="tv-card rounded-md border border-border bg-surface p-5">
            <dt className="text-sm font-semibold text-ink">{t(`landing.challenge.${k}.q` as MessageKey)}</dt>
            <dd className="mt-1 text-sm text-ink-2">{t(`landing.challenge.${k}.a` as MessageKey)}</dd>
          </div>
        ))}
      </dl>
    </Section>
  );
}

export function CosmoGlossary() {
  const { t } = useI18n();
  return (
    <Section id="cosmo" title={t("landing.cosmo.title")}>
      <p className="mt-2 max-w-[70ch] text-body text-ink-2">{t("landing.cosmo.body")}</p>
      <div className="mt-5 space-y-2">
        {GLOSSARY.map((k) => (
          <details key={k} className="tv-card rounded-md border border-border bg-surface">
            <summary className="cursor-pointer px-4 py-3 text-sm font-semibold text-ink">{t(`landing.gloss.${k}` as MessageKey)}</summary>
            <p className="border-t border-border px-4 py-3 text-sm text-ink-2">{t(`cosmo.gloss.${k}` as MessageKey)}</p>
          </details>
        ))}
      </div>
    </Section>
  );
}

export function Roadmap() {
  const { t } = useI18n();
  return (
    <Section id="roadmap" title={t("landing.roadmap.title")}>
      <ul className="mt-4 grid gap-3 sm:grid-cols-2">
        {ROADMAP.map((k) => (
          <li key={k} className="rounded-md border border-dashed border-border-strong bg-surface p-4 text-sm text-ink-2">
            <span className="mr-2 rounded-sm bg-sunken px-1.5 py-0.5 text-xs font-semibold text-ink-muted">{t("landing.roadmap.planned")}</span>
            {t(`landing.roadmap.${k}` as MessageKey)}
          </li>
        ))}
      </ul>
    </Section>
  );
}
