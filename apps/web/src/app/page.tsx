"use client";

import { ArrowRight, Code2 } from "lucide-react";
import Link from "next/link";
import validation from "@travertine/contract/fixtures/validation.json";
import { BrandLockup } from "@/components/brand/logo";
import { SiteFooter } from "@/components/shell/site-footer";
import { useI18n, type MessageKey } from "@/i18n";
import { DEMO_FIELD } from "@/lib/api/mock";
import { encodePolyline, type LngLat } from "@/lib/geo";

const REPO = "https://github.com/musbabaff/travertine";
const ring = DEMO_FIELD.geometry.coordinates[0].slice(0, -1) as LngLat[];
const DEMO_HREF = `/app?lat=${DEMO_FIELD.lat}&lon=${DEMO_FIELD.lon}&f=${encodeURIComponent(encodePolyline(ring))}`;

const STEPS = ["mark", "read", "rank"] as const;
const SOURCES = [
  { name: "NASA POWER", key: "landing.src.power" },
  { name: "MODIS MOD13Q1", key: "landing.src.modis" },
  { name: "ISRIC SoilGrids 2.0", key: "landing.src.soil" },
  { name: "FAO-56", key: "landing.src.fao" },
] as const;

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

export default function Landing() {
  const { t, n } = useI18n();
  const years = validation.years.map((y) => y.year);
  const span = `${Math.min(...years)}–${Math.max(...years)}`;
  const ci = validation.correlation_ci95;
  const base = validation.baseline;
  const diff = validation.difference_ci95;

  return (
    <>
      <main id="main" className="mx-auto w-full max-w-[1100px] flex-1 px-4 md:px-6">
        {/* Promise */}
        <div className="flex flex-col gap-5 py-14 md:py-24">
          <BrandLockup className="mb-2 h-9 self-start md:h-11" />
          <p className="text-xs font-medium uppercase tracking-[0.04em] text-ink-muted">{t("home.eyebrow")}</p>
          <h1 className="max-w-[22ch] text-h1 font-semibold tracking-[-0.01em] md:text-display">{t("home.title")}</h1>
          <p className="max-w-[60ch] text-body text-ink-2">{t("home.body")}</p>
          <div className="flex flex-wrap gap-3">
            <Link href={DEMO_HREF} className="inline-flex h-11 items-center gap-2 rounded-md bg-teal-700 px-5 text-sm font-medium text-white hover:bg-teal-600">
              {t("landing.cta.demo")}
              <ArrowRight aria-hidden className="size-4" strokeWidth={1.5} />
            </Link>
            <Link href="/app" className="inline-flex h-11 items-center rounded-md border border-border-strong px-5 text-sm font-medium text-ink hover:bg-sunken">
              {t("landing.cta.own")}
            </Link>
          </div>
        </div>

        <Section id="problem" title={t("landing.problem.title")}>
          <p className="mt-3 max-w-[70ch] text-body text-ink-2">{t("landing.problem.body")}</p>
        </Section>

        <Section id="how" title={t("landing.how.title")}>
          <ol className="mt-6 grid gap-4 md:grid-cols-3">
            {STEPS.map((s, i) => (
              <li key={s} className="rounded-md border border-border bg-surface p-5 shadow-1">
                <span className="inline-flex size-8 items-center justify-center rounded-full bg-teal-100 text-sm font-semibold text-teal-700">{i + 1}</span>
                <h3 className="mt-3 text-h3 font-semibold">{t(`landing.how.${s}.title` as MessageKey)}</h3>
                <p className="mt-1 text-sm text-ink-2">{t(`landing.how.${s}.body` as MessageKey)}</p>
              </li>
            ))}
          </ol>
        </Section>

        <Section id="evidence" title={t("landing.evidence.title")}>
          <p className="mt-3 max-w-[70ch] text-body text-ink-2">{t("landing.evidence.body", { span, n: validation.n })}</p>
          <dl className="mt-6 grid gap-4 sm:grid-cols-3">
            <div className="rounded-md border border-border bg-surface p-5">
              <dt className="text-xs text-ink-muted">{t("evidence.compare.model")}</dt>
              <dd className="mt-1 text-h2 font-semibold tabular-nums">r = {n(validation.correlation, 2)}</dd>
              {ci && <dd className="text-xs tabular-nums text-ink-2">{t("evidence.compare.ci", { lo: n(ci[0], 2), hi: n(ci[1], 2) })}</dd>}
            </div>
            {base && (
              <div className="rounded-md border border-border bg-surface p-5">
                <dt className="text-xs text-ink-muted">{t("landing.evidence.baseline")}</dt>
                <dd className="mt-1 text-h2 font-semibold tabular-nums">r = {n(base.correlation, 2)}</dd>
                <dd className="text-xs tabular-nums text-ink-2">{t("evidence.compare.ci", { lo: n(base.correlation_ci95[0], 2), hi: n(base.correlation_ci95[1], 2) })}</dd>
              </div>
            )}
            {diff && (
              <div className="rounded-md border border-border bg-surface p-5">
                <dt className="text-xs text-ink-muted">{t("evidence.compare.diff")}</dt>
                <dd className="mt-1 text-sm font-semibold text-ink">{t("evidence.verdict.no_detectable_difference")}</dd>
                <dd className="text-xs tabular-nums text-ink-2">{t("evidence.compare.ci", { lo: n(diff[0], 2), hi: n(diff[1], 2) })}</dd>
              </div>
            )}
          </dl>
          <p className="mt-3 text-sm">
            <Link href={`/app/evidence?${DEMO_HREF.split("?")[1]}`} className="font-medium text-teal-700 underline-offset-2 hover:underline">
              {t("landing.evidence.link")}
            </Link>
          </p>
        </Section>

        <Section id="data" title={t("landing.data.title")}>
          <ul className="mt-6 grid gap-4 sm:grid-cols-2">
            {SOURCES.map((s) => (
              <li key={s.name} className="rounded-md border border-border bg-surface p-5">
                <p className="text-sm font-semibold text-ink">{s.name}</p>
                <p className="mt-1 text-sm text-ink-2">{t(s.key)}</p>
              </li>
            ))}
          </ul>
        </Section>

        <Section id="limits" title={t("landing.limits.title")}>
          <ul className="mt-4 max-w-[75ch] list-disc space-y-2 pl-5 text-body text-ink-2">
            {(["grid", "soil", "pixel", "past", "yield"] as const).map((k) => (
              <li key={k}>{t(`landing.limits.${k}` as MessageKey)}</li>
            ))}
          </ul>
        </Section>

        <Section id="team" title={t("landing.team.title")}>
          <ul className="mt-6 grid gap-4 sm:grid-cols-2">
            <li className="rounded-md border border-border bg-surface p-5">
              <p className="text-sm font-semibold text-ink">Mustafa Babayev</p>
              <p className="text-sm text-ink-2">{t("landing.team.web")}</p>
            </li>
            <li className="rounded-md border border-border bg-surface p-5">
              <p className="text-sm font-semibold text-ink">Kemal Gencel</p>
              <p className="text-sm text-ink-2">{t("landing.team.engine")}</p>
            </li>
          </ul>
          <p className="mt-6 max-w-[75ch] text-sm text-ink-2">{t("landing.ai")}</p>
          <a href={REPO} className="mt-4 inline-flex h-11 items-center gap-2 rounded-md border border-border-strong px-5 text-sm font-medium text-ink hover:bg-sunken">
            <Code2 aria-hidden className="size-4" strokeWidth={1.5} />
            {t("landing.source")}
          </a>
        </Section>
      </main>
      <SiteFooter />
    </>
  );
}
