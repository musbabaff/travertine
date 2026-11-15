"use client";

import { ArrowLeft, MapPinned, Printer } from "lucide-react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useMemo } from "react";
import { ProvenanceChips } from "@/components/ui/provenance-chip";
import { SlowHint } from "@/components/ui/slow-hint";
import { EmptyState, ErrorState, Skeleton } from "@/components/ui/states";
import { useI18n, type MessageKey } from "@/i18n";
import { useDataSource } from "@/lib/api/source";
import type { Crop, FieldCalendar } from "@/lib/api/types";
import { parseExplore, type Horizon } from "@/lib/priorities";
import { cropName } from "../explore/crop-timeline";
import { ReasoningParts } from "../explore/reasoning";
import { useCrops, useRotations } from "../explore/use-explore";
import { useField } from "../field/use-field";
import { useCalendar } from "./use-calendar";

const MONTHS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];

/** The plan's sequence lives in `plan=crop,crop,...`; 3 to 5 crop years. */
export function parsePlan(params: URLSearchParams): string[] {
  return (params.get("plan") ?? "").split(",").map((s) => s.trim()).filter(Boolean).slice(0, 5);
}

function useMonthName(locale: "en" | "tr") {
  return useMemo(() => {
    const f = new Intl.DateTimeFormat(locale === "tr" ? "tr-TR" : "en-GB", { month: "short", timeZone: "UTC" });
    return (m: number) => f.format(new Date(Date.UTC(2001, m - 1, 1)));
  }, [locale]);
}

function useDayMonth(locale: "en" | "tr") {
  return useMemo(() => {
    const f = new Intl.DateTimeFormat(locale === "tr" ? "tr-TR" : "en-GB", { day: "numeric", month: "short", timeZone: "UTC" });
    return (mmdd: string) => {
      const [m, d] = mmdd.split("-").map(Number);
      return f.format(new Date(Date.UTC(2001, m - 1, d)));
    };
  }, [locale]);
}

function Card({ id, title, children }: { id: string; title: string; children: React.ReactNode }) {
  return (
    <section aria-labelledby={id} className="tv-plan-card rounded-md border border-border bg-surface p-4 md:p-5">
      <h2 id={id} className="text-h3 font-semibold text-ink">
        {title}
      </h2>
      {children}
    </section>
  );
}

function Calendar({ cal, name }: { cal: FieldCalendar; name: (id: string) => string }) {
  const { t, n, locale } = useI18n();
  const month = useMonthName(locale);
  const day = useDayMonth(locale);
  const pct = (v: number) => `${n(v * 100)} %`;
  const years = cal.seasons;
  return (
    <>
      <table className="mt-3 w-full text-sm">
        <caption className="sr-only">{t("plan.calendar.title")}</caption>
        <thead className="text-left text-xs text-ink-2">
          <tr>
            <th scope="col" className="py-1.5 pr-3 font-medium">{t("plan.year")}</th>
            <th scope="col" className="py-1.5 pr-3 font-medium">{t("plan.crop")}</th>
            <th scope="col" className="py-1.5 pr-3 font-medium">{t("plan.sowing")}</th>
            <th scope="col" className="py-1.5 pr-3 font-medium">{t("plan.harvest")}</th>
            <th scope="col" className="py-1.5 font-medium">{t("plan.bareAfter")}</th>
          </tr>
        </thead>
        <tbody>
          {years.map((s) => {
            const bare = cal.bare_periods.find((b) => b.after_year_index === s.year_index);
            return (
              <tr key={s.year_index} className="border-t border-border">
                <td className="py-1.5 pr-3 tabular-nums">{s.year_index}</td>
                <th scope="row" className="py-1.5 pr-3 text-left font-medium">{name(s.crop_id)}</th>
                <td className="py-1.5 pr-3 tabular-nums">{day(s.sowing)}</td>
                <td className="py-1.5 pr-3 tabular-nums">{day(s.harvest)}</td>
                <td className="py-1.5 tabular-nums">{bare ? t("plan.bare", { from: day(bare.start), to: day(bare.end), days: bare.days }) : "—"}</td>
              </tr>
            );
          })}
        </tbody>
      </table>

      <h3 className="mt-5 text-sm font-semibold text-ink">{t("plan.months.title")}</h3>
      <p className="text-xs text-ink-muted">{t("plan.months.subtitle")}</p>
      <div className="mt-2 overflow-x-auto">
        <table className="w-full min-w-[560px] text-xs tabular-nums">
          <thead className="text-ink-2">
            <tr>
              <th scope="col" className="py-1 pr-2 text-left font-medium">{t("plan.crop")}</th>
              {MONTHS.map((m) => (
                <th key={m} scope="col" className="px-1 py-1 text-right font-medium">{month(m)}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {years.map((s) => (
              <tr key={s.year_index} className="border-t border-border">
                <th scope="row" className="py-1 pr-2 text-left font-medium">{s.year_index}. {name(s.crop_id)}</th>
                {MONTHS.map((m) => {
                  const c = cal.months.find((x) => x.year_index === s.year_index && x.month === m);
                  return (
                    <td key={m} className={`px-1 py-1 text-right ${c && c.water_deficit_share >= 0.5 ? "font-semibold text-ink" : "text-ink-2"}`}>
                      {c ? pct(c.water_deficit_share) : ""}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <h3 className="mt-5 text-sm font-semibold text-ink">{t("plan.vulnerable.title")}</h3>
      <ul className="mt-1 space-y-1 text-sm text-ink-2">
        {years.map((s) => {
          const items = cal.most_vulnerable.filter((v) => v.year_index === s.year_index);
          return (
            <li key={s.year_index}>
              <span className="font-medium text-ink">{s.year_index}. {name(s.crop_id)}:</span>{" "}
              {items.length
                ? items.map((v) => t("plan.vulnerable.item", { hazard: t(`plan.hazard.${v.hazard}` as MessageKey), month: month(v.month), share: pct(v.share) })).join(" · ")
                : t("plan.vulnerable.none")}
            </li>
          );
        })}
      </ul>
    </>
  );
}

export function PlanScreen() {
  const { t, n, locale } = useI18n();
  const params = useSearchParams();
  const qs = params.toString();
  const { field } = useField();
  const source = useDataSource();
  const plan = parsePlan(new URLSearchParams(qs));
  const { priorities } = parseExplore(new URLSearchParams(qs));
  const horizon = Math.min(5, Math.max(3, plan.length)) as Horizon;
  const rotations = useRotations(plan.length >= 3 ? field : null, priorities, horizon, plan, locale);
  const calendar = useCalendar(plan.length ? field : null, plan, locale);
  const crops = useCrops();
  const cropMap = useMemo(() => (crops.data ? new Map<string, Crop>(crops.data.map((c) => [c.id, c])) : undefined), [crops.data]);
  const name = (id: string) => cropName(id, cropMap, locale);
  const back = `/app/explore?${qs}`;

  if (!field || plan.length < 3) {
    return (
      <div id="main" tabIndex={-1} className="mx-auto w-full max-w-xl px-4 py-16 md:px-6">
        <EmptyState icon={<MapPinned aria-hidden className="size-6 text-teal-700" strokeWidth={1.5} />} title={t("plan.empty.title")} body={t("plan.empty.body")}>
          <Link href={field ? back : "/app"} className="inline-flex h-11 items-center rounded-md bg-teal-700 px-4 text-sm font-medium text-white hover:bg-teal-600 md:h-10">
            {field ? t("plan.empty.cta") : t("explore.noField.cta")}
          </Link>
        </EmptyState>
      </div>
    );
  }

  const scored = rotations.data?.baseline;
  const cal = calendar.data?.data;
  const demo = source !== "engine" || !!calendar.data?.fromFixture;
  const provenance = [...(cal?.provenance ?? []), ...(rotations.data?.provenance ?? [])].filter((p, i, all) => all.findIndex((q) => q.dataset === p.dataset) === i);

  return (
    <div className="tv-feature-page tv-plan mx-auto w-full max-w-[1100px] px-4 pb-16 pt-6 md:px-6 md:pt-8">
      <div className="tv-page-banner mb-6">
        <span className="tv-banner-eyebrow">{t("plan.eyebrow")}</span>
        <h1 id="main" tabIndex={-1} className="text-h2 font-semibold tracking-[-0.01em] md:text-h1">
          {plan.map(name).join(" → ")}
        </h1>
        <p className="mt-1 text-sm">
          {t("plan.where", { lat: n(field.lat, 4), lon: n(field.lon, 4), years: plan.length })}
          {field.irrigated ? ` · ${t("plan.irrigated")}` : ` · ${t("plan.rainfed")}`}
        </p>
      </div>

      <div className="no-print mb-4 flex flex-wrap items-center gap-3">
        <Link href={back} className="inline-flex h-11 items-center gap-2 rounded-md border border-border-strong px-4 text-sm font-medium text-ink hover:bg-sunken md:h-10">
          <ArrowLeft aria-hidden className="size-4" strokeWidth={1.5} />
          {t("plan.back")}
        </Link>
        <button type="button" onClick={() => window.print()} className="inline-flex h-11 items-center gap-2 rounded-md bg-teal-700 px-4 text-sm font-medium text-white hover:bg-teal-600 md:h-10">
          <Printer aria-hidden className="size-4" strokeWidth={1.5} />
          {t("plan.print")}
        </button>
        {demo && <span className="text-xs text-warning">{t("source.demo")}</span>}
      </div>

      <p className="mb-4 rounded-md border border-border bg-surface p-3 text-sm font-medium text-ink">{t("landing.supports")}</p>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card id="plan-calendar" title={t("plan.calendar.title")}>
          {calendar.isPending ? (
            <div className="mt-3 space-y-2" aria-busy="true">
              <SlowHint />
              <Skeleton className="h-24 w-full" />
            </div>
          ) : calendar.isError ? (
            <ErrorState title={t("state.error.title")} body={t("state.error.body", { message: calendar.error.message })} retryLabel={t("state.retry")} onRetry={() => calendar.refetch()} />
          ) : cal ? (
            <Calendar cal={cal} name={name} />
          ) : null}
        </Card>

        <Card id="plan-water" title={t("plan.water.title")}>
          <p className="text-xs text-ink-muted">{t("plan.water.subtitle")}</p>
          {rotations.isPending ? (
            <Skeleton className="mt-3 h-24 w-full" />
          ) : rotations.isError ? (
            <ErrorState title={t("state.error.title")} body={t("state.error.body", { message: rotations.error.message })} retryLabel={t("state.retry")} onRetry={() => rotations.refetch()} />
          ) : scored ? (
            <>
              <table className="mt-3 w-full text-sm tabular-nums">
                <thead className="text-left text-xs text-ink-2">
                  <tr>
                    <th scope="col" className="py-1.5 pr-3 font-medium">{t("plan.year")}</th>
                    <th scope="col" className="py-1.5 pr-3 font-medium">{t("plan.crop")}</th>
                    <th scope="col" className="py-1.5 pr-3 text-right font-medium">{t("plan.demand")}</th>
                    <th scope="col" className="py-1.5 pr-3 text-right font-medium">{t("plan.deficit")}</th>
                    <th scope="col" className="py-1.5 text-right font-medium">{t("plan.stress")}</th>
                  </tr>
                </thead>
                <tbody>
                  {scored.yearly.map((y) => (
                    <tr key={y.year_index} className="border-t border-border">
                      <td className="py-1.5 pr-3">{y.year_index}</td>
                      <th scope="row" className="py-1.5 pr-3 text-left font-medium">{name(y.crop_id)}</th>
                      <td className="py-1.5 pr-3 text-right">{n(y.water_demand_mm)} {t("unit.mm")}</td>
                      <td className="py-1.5 pr-3 text-right">{n(y.water_deficit_mm)} {t("unit.mm")}</td>
                      <td className="py-1.5 text-right">{n(y.stress_index, 2)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <p className="mt-3 text-xs text-ink-2">
                {t("plan.scores", { water: n(scored.scores.water, 2), income: n(scored.scores.income, 2), soil: n(scored.scores.soil, 2), risk: n(scored.scores.risk, 2), total: n(scored.scores.total, 2) })}
              </p>
              {scored.rule_violations.length > 0 && (
                <ul className="mt-2 space-y-1 text-xs text-warning">
                  {scored.rule_violations.map((v, i) => (
                    <li key={i}>{v.message}</li>
                  ))}
                </ul>
              )}
            </>
          ) : null}
        </Card>
      </div>

      {scored?.reasoning && (
        <div className="mt-4">
          <ReasoningParts reasoning={scored.reasoning} open />
        </div>
      )}

      {cal && (
        <section aria-labelledby="plan-caveats" className="mt-4 text-sm text-ink-2">
          <h2 id="plan-caveats" className="text-sm font-semibold text-ink">{t("evidence.caveats")}</h2>
          <ul className="mt-1 list-disc space-y-1 pl-5">
            {cal.caveats.map((c) => (
              <li key={c}>{c}</li>
            ))}
            <li>{t("plan.relative")}</li>
          </ul>
        </section>
      )}

      {provenance.length > 0 && (
        <div className="mt-4 flex flex-wrap items-center gap-2">
          <span className="text-xs text-ink-muted">{t("provenance.label")}</span>
          <ProvenanceChips items={provenance} />
        </div>
      )}
      <p className="tv-print-only mt-4 text-xs">{t("plan.printFooter", { url: "travertinefields.com" })}</p>
    </div>
  );
}
