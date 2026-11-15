"use client";

import { ArrowRight, Code2, Database, Leaf, Satellite, Sprout, ThermometerSun } from "lucide-react";
import Link from "next/link";
import { SiteFooter } from "@/components/shell/site-footer";
import { DemoEvidence, PooledHighlight } from "@/features/landing/landing-evidence";
import { ChallengeMap, CosmoGlossary, CurrentEntry, LiveDemo, MultiSite, Roadmap } from "@/features/landing/landing-extra";
import { ShowcasePicker } from "@/features/showcase/showcase-picker";
import { useI18n, type MessageKey } from "@/i18n";
import { DEMO_FIELD } from "@/lib/api/mock";
import { encodePolyline, type LngLat } from "@/lib/geo";

const REPO = "https://github.com/musbabaff/travertine";
const ring = DEMO_FIELD.geometry.coordinates[0].slice(0, -1) as LngLat[];
const DEMO_HREF = `/app?lat=${DEMO_FIELD.lat}&lon=${DEMO_FIELD.lon}&f=${encodeURIComponent(encodePolyline(ring))}`;

const STEPS = ["mark", "read", "rank"] as const;
const SOURCES = [
  { name: "NASA POWER", key: "landing.src.power", icon: ThermometerSun },
  { name: "MODIS MOD13Q1", key: "landing.src.modis", icon: Satellite },
  { name: "HLS v2.0 (Landsat + Sentinel-2)", key: "landing.src.hls", icon: Leaf },
  { name: "ISRIC SoilGrids 2.0", key: "landing.src.soil", icon: Sprout },
  { name: "FAO-56", key: "landing.src.fao", icon: Database },
] as const;
const TEAM = [
  { name: "Mustafa Babayev", role: "landing.team.web" },
  { name: "Kemal Gencel", role: "landing.team.engine" },
  { name: "Azra Özkan", role: "landing.team.research" },
] as const;

function Section({ id, title, children }: { id: string; title: string; children: React.ReactNode }) {
  return (
    <section aria-labelledby={id} className="py-10 md:py-14">
      <h2 id={id} className="text-h2 font-semibold tracking-[-0.01em]">
        {title}
      </h2>
      {children}
    </section>
  );
}

export default function Landing() {
  const { t } = useI18n();
  const evidenceHref = `/app/evidence?${DEMO_HREF.split("?")[1]}`;

  return (
    <>
      <main id="main" className="mx-auto w-full max-w-[1200px] flex-1 px-4 pt-4 md:px-6 md:pt-6">
        <div className="tv-landing-hero">
          <div className="tv-landing-hero-copy">
            <p className="tv-banner-eyebrow">{t("home.eyebrow")}</p>
            <h1 className="max-w-[22ch] text-h1 font-semibold tracking-[-0.01em] md:text-display">{t("home.title")}</h1>
            <p className="max-w-[56ch] text-body">{t("home.body")}</p>
            <div className="flex flex-wrap gap-3">
              <Link href={DEMO_HREF} className="tv-landing-btn is-primary">
                {t("landing.cta.demo")}
                <ArrowRight aria-hidden className="size-4" strokeWidth={1.5} />
              </Link>
              <Link href="/app" className="tv-landing-btn">
                {t("landing.cta.own")}
              </Link>
            </div>
            <p className="tv-landing-supports">{t("landing.supports")}</p>
          </div>
          <LiveDemo demoHref={DEMO_HREF} />
        </div>

        <Section id="evidence" title={t("landing.evidence.title")}>
          <PooledHighlight />
          <DemoEvidence evidenceHref={evidenceHref} />
        </Section>

        <div className="pb-4">
          <ShowcasePicker />
        </div>

        <MultiSite />

        <Section id="how" title={t("landing.how.title")}>
          <ol className="mt-6 grid gap-4 md:grid-cols-3">
            {STEPS.map((s, i) => (
              <li key={s} className="tv-card rounded-md border border-border bg-surface p-5">
                <span className="inline-flex size-8 items-center justify-center rounded-full bg-teal-100 text-sm font-semibold text-teal-700">{i + 1}</span>
                <h3 className="mt-3 text-h3 font-semibold">{t(`landing.how.${s}.title` as MessageKey)}</h3>
                <p className="mt-1 text-sm text-ink-2">{t(`landing.how.${s}.body` as MessageKey)}</p>
              </li>
            ))}
          </ol>
        </Section>

        <Section id="problem" title={t("landing.problem.title")}>
          <p className="mt-3 max-w-[70ch] text-body text-ink-2">{t("landing.problem.body")}</p>
        </Section>

        <CurrentEntry demoHref={DEMO_HREF} />

        <Section id="data" title={t("landing.data.title")}>
          <ul className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {SOURCES.map((s) => (
              <li key={s.name} className="tv-card rounded-md border border-border bg-surface p-5">
                <div className="tv-card-icon green mb-3">
                  <s.icon aria-hidden />
                </div>
                <p className="text-sm font-semibold text-ink">{s.name}</p>
                <p className="mt-1 text-sm text-ink-2">{t(s.key)}</p>
              </li>
            ))}
          </ul>
        </Section>

        <ChallengeMap />

        <CosmoGlossary />

        <Section id="limits" title={t("landing.limits.title")}>
          <ul className="mt-4 max-w-[75ch] list-disc space-y-2 pl-5 text-body text-ink-2">
            {(["grid", "soil", "pixel", "past", "yield"] as const).map((k) => (
              <li key={k}>{t(`landing.limits.${k}` as MessageKey)}</li>
            ))}
          </ul>
          <p className="mt-4 max-w-[75ch] rounded-md border border-border bg-surface p-4 text-body font-medium text-ink">{t("landing.supports")}</p>
        </Section>

        <Roadmap />

        <Section id="team" title={t("landing.team.title")}>
          <ul className="mt-6 grid gap-4 sm:grid-cols-3">
            {TEAM.map((m) => (
              <li key={m.name} className="tv-card rounded-md border border-border bg-surface p-5">
                <p className="text-sm font-semibold text-ink">{m.name}</p>
                <p className="text-sm text-ink-2">{t(m.role)}</p>
              </li>
            ))}
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
