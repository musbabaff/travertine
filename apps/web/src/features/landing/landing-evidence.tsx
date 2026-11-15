"use client";

import { ArrowRight } from "lucide-react";
import Link from "next/link";
import { useI18n, type MessageKey } from "@/i18n";
import { DEMO_FIELD } from "@/lib/api/mock";
import type { LngLat } from "@/lib/geo";
import type { FieldState } from "@/lib/url-state";
import { period, useValidation } from "../evidence/use-validation";
import { useShowcase } from "../showcase/use-showcase";

const demoField: FieldState = {
  lat: DEMO_FIELD.lat,
  lon: DEMO_FIELD.lon,
  ring: DEMO_FIELD.geometry.coordinates[0].slice(0, -1) as LngLat[],
  irrigated: DEMO_FIELD.irrigated,
};

/** The pooled multi-site result, highlighted, with the engine's verdict wording. Hidden until the engine answers. */
export function PooledHighlight() {
  const { t, n } = useI18n();
  const q = useShowcase();
  const pooled = q.data && !q.data.fromFixture ? q.data.data.pooled : undefined;
  if (!pooled) return null;
  const established = q.data!.data.fields.filter((f) => f.validation.verdict && f.validation.verdict !== "no_detectable_difference").length;
  const ci = (v: [number, number] | number[]) => t("evidence.compare.ci", { lo: n(v[0], 2), hi: n(v[1], 2) });
  return (
    <div className="tv-landing-highlight" data-testid="pooled-highlight">
      <p className="tv-banner-eyebrow">{t("landing.pooled.eyebrow", { sites: pooled.sites })}</p>
      <dl className="tv-landing-stats">
        <div>
          <dt>{t("landing.pooled.model")}</dt>
          <dd>r = {n(pooled.mean_correlation, 2)}</dd>
          <dd className="tv-landing-ci">{ci(pooled.mean_correlation_ci95)}</dd>
        </div>
        <div>
          <dt>{t("landing.pooled.baseline")}</dt>
          <dd>r = {n(pooled.mean_baseline_correlation, 2)}</dd>
          <dd className="tv-landing-ci">{ci(pooled.mean_baseline_correlation_ci95)}</dd>
        </div>
        <div>
          <dt>{t("landing.pooled.diff")}</dt>
          <dd>{n(pooled.mean_difference, 2)}</dd>
          <dd className="tv-landing-ci">{ci(pooled.mean_difference_ci95)}</dd>
        </div>
      </dl>
      <p className="tv-landing-verdict">{t(`evidence.verdict.${pooled.verdict}` as MessageKey)}</p>
      <p className="tv-landing-note">{t("landing.pooled.note", { established, sites: pooled.sites })}</p>
    </div>
  );
}

/** Demo-field back-test from the live engine (the contract fixture only while the engine is unreachable, labelled). */
export function DemoEvidence({ evidenceHref }: { evidenceHref: string }) {
  const { t, n, locale } = useI18n();
  const q = useValidation(demoField, locale);
  const v = q.data?.data;
  const span = v ? period(v) : null;
  const card = "tv-card rounded-md border border-border bg-surface p-5";
  return (
    <>
      <p className="mt-3 max-w-[70ch] text-body text-ink-2">
        {v && span ? t("landing.evidence.body", { span: `${span[0]}–${span[1]}`, n: v.n }) : t("overview.loading")}
      </p>
      {q.data?.fromFixture && <p className="mt-2 text-xs text-warning">{t("source.demo")}</p>}
      {v && (
        <dl className="mt-6 grid gap-4 sm:grid-cols-3">
          <div className={card}>
            <dt className="text-xs text-ink-muted">{t("evidence.compare.model")}</dt>
            <dd className="mt-1 text-h2 font-semibold tabular-nums">r = {n(v.correlation, 2)}</dd>
            {v.correlation_ci95 && <dd className="text-xs tabular-nums text-ink-2">{t("evidence.compare.ci", { lo: n(v.correlation_ci95[0], 2), hi: n(v.correlation_ci95[1], 2) })}</dd>}
          </div>
          {v.baseline && (
            <div className={card}>
              <dt className="text-xs text-ink-muted">{t("landing.evidence.baseline")}</dt>
              <dd className="mt-1 text-h2 font-semibold tabular-nums">r = {n(v.baseline.correlation, 2)}</dd>
              <dd className="text-xs tabular-nums text-ink-2">{t("evidence.compare.ci", { lo: n(v.baseline.correlation_ci95[0], 2), hi: n(v.baseline.correlation_ci95[1], 2) })}</dd>
            </div>
          )}
          {v.difference_ci95 && v.verdict && (
            <div className={card}>
              <dt className="text-xs text-ink-muted">{t("evidence.compare.diff")}</dt>
              <dd className="mt-1 text-sm font-semibold text-ink">{t(`evidence.verdict.${v.verdict}` as MessageKey)}</dd>
              <dd className="text-xs tabular-nums text-ink-2">{t("evidence.compare.ci", { lo: n(v.difference_ci95[0], 2), hi: n(v.difference_ci95[1], 2) })}</dd>
            </div>
          )}
        </dl>
      )}
      <Link href={evidenceHref} className="mt-4 inline-flex items-center gap-1 text-sm font-medium text-teal-700 underline-offset-2 hover:underline">
        {t("landing.evidence.link")} <ArrowRight aria-hidden className="size-4" />
      </Link>
    </>
  );
}
