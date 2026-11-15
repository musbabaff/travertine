"use client";

import { ArrowUpRight, CloudSun, Droplets, Layers, MapPinned, RefreshCw, Sprout, Thermometer, Waves } from "lucide-react";
import Link from "next/link";
import { useField, useFieldAnalysis } from "@/features/field/use-field";
import { useI18n, type MessageKey } from "@/i18n";
import { DEMO_FIELD } from "@/lib/api/mock";
import { useDataSource } from "@/lib/api/source";
import { polygonAreaM2, type LngLat } from "@/lib/geo";
import { writeField, type FieldState } from "@/lib/url-state";

const exampleField: FieldState = {
  lat: DEMO_FIELD.lat,
  lon: DEMO_FIELD.lon,
  ring: DEMO_FIELD.geometry.coordinates[0].slice(0, -1) as LngLat[],
  irrigated: DEMO_FIELD.irrigated,
};

const average = (values: number[]) => (values.length ? values.reduce((total, value) => total + value, 0) / values.length : null);

/** Field overview: every value is from the engine's field analysis for the selected (or demo) field. */
export function DashboardScreen() {
  const { field } = useField();
  const { n, t } = useI18n();
  const source = useDataSource();
  const selectedField = field ?? exampleField;
  const analysis = useFieldAnalysis(selectedField);
  const data = analysis.data;
  const climate = data?.climate ?? [];
  const recent = climate.slice(-12);
  const temperature = average(climate.map((y) => y.mean_temp_c));
  const rainfall = average(climate.map((y) => y.precipitation_mm));
  const et0 = average(climate.map((y) => y.et0_mm));
  const wetness = average(climate.map((y) => y.root_zone_wetness));
  const ndvi = average((data?.ndvi_history ?? []).map((y) => y.mean_ndvi));
  const area = selectedField.ring ? polygonAreaM2(selectedField.ring) / 10_000 : null;
  const query = writeField(new URLSearchParams(), selectedField).toString();
  const fieldHref = `/app?${query}`;
  const exploreHref = `/app/explore?${query}`;
  const evidenceHref = `/app/evidence?${query}`;
  const maxRain = Math.max(1, ...recent.map((y) => y.precipitation_mm));
  const textureKey = `texture.${data?.soil.texture.toLowerCase()}` as MessageKey;
  const texture = data ? (t(textureKey) === textureKey ? data.soil.texture : t(textureKey)) : "—";
  const pending = analysis.isError ? t("overview.failed") : t("overview.loading");
  const ratio = rainfall === null || et0 === null ? null : Math.round((rainfall / Math.max(et0, 1)) * 100);

  return (
    <main id="main" tabIndex={-1} className="tv-dashboard">
      <div className="tv-dashboard-intro">
        <div>
          <span className="tv-eyebrow">{t("overview.eyebrow")}</span>
          <h1>{t("overview.title")}</h1>
        </div>
        <span className="tv-context-chip">
          <MapPinned size={15} aria-hidden />
          {field ? t("overview.selected") : t("overview.example")}
        </span>
      </div>

      <div className="tv-dashboard-grid">
        <div className="tv-dashboard-metrics">
          <section className="tv-card tv-climate" aria-labelledby="tv-climate-title">
            <div className="tv-card-head">
              <div className="tv-card-icon">
                <CloudSun aria-hidden />
              </div>
              <span>{t("overview.climate")}</span>
            </div>
            <h2 id="tv-climate-title">{t("overview.temp")}</h2>
            {temperature === null ? (
              <p className="tv-value-placeholder">{pending}</p>
            ) : (
              <p className="tv-climate-value">
                {n(temperature, 1)}
                <span>°C</span>
              </p>
            )}
            <div className="tv-climate-strip" aria-hidden>
              <span />
            </div>
            <div className="tv-card-foot">
              <span>{t("overview.period", { from: climate[0]?.year ?? "—", to: climate.at(-1)?.year ?? "—" })}</span>
              <span>NASA POWER</span>
            </div>
          </section>

          <section className="tv-card tv-soil" aria-labelledby="tv-soil-title">
            <div className="tv-card-head">
              <div className="tv-card-icon green">
                <Sprout aria-hidden />
              </div>
              <Link href={fieldHref} aria-label={t("overview.openField")}>
                <ArrowUpRight aria-hidden />
              </Link>
            </div>
            <h2 id="tv-soil-title">{t("overview.soilVeg")}</h2>
            <div className="tv-soil-main">
              <div className="tv-soil-ring" style={{ "--ring-fill": `${Math.round((ndvi ?? 0) * 100)}%` } as React.CSSProperties}>
                <div>
                  <strong>{ndvi === null ? "—" : n(ndvi, 2)}</strong>
                  <span>{t("overview.ndvi")}</span>
                </div>
              </div>
              <div className="tv-soil-details">
                <div>
                  <span>{t("summary.texture")}</span>
                  <strong>{texture}</strong>
                </div>
                <div>
                  <span>{t("summary.ph")}</span>
                  <strong>{data ? n(data.soil.ph, 1) : "—"}</strong>
                </div>
                <div>
                  <span>{t("summary.oc")}</span>
                  <strong>{data ? `${n(data.soil.organic_carbon, 1)} ${t("unit.gkg")}` : "—"}</strong>
                </div>
              </div>
            </div>
          </section>

          <section className="tv-card tv-water" aria-labelledby="tv-water-title">
            <div className="tv-card-head">
              <div className="tv-card-icon blue">
                <Droplets aria-hidden />
              </div>
              <span>{t("overview.water")}</span>
            </div>
            <h2 id="tv-water-title">{t("overview.waterTitle")}</h2>
            <div className="tv-water-pair">
              <div>
                <span>{t("overview.rain")}</span>
                <strong>
                  {rainfall === null ? "—" : n(rainfall)} <small>mm</small>
                </strong>
              </div>
              <div>
                <span>{t("overview.et0")}</span>
                <strong>
                  {et0 === null ? "—" : n(et0)} <small>mm</small>
                </strong>
              </div>
            </div>
            <div className="tv-water-track" role="img" aria-label={ratio === null ? pending : t("overview.ratio", { pct: ratio })}>
              <span style={{ width: `${Math.min(100, ratio ?? 0)}%` }} />
            </div>
            <p>{ratio === null ? pending : t("overview.ratio", { pct: ratio })}</p>
          </section>

          <section className="tv-card tv-decision" aria-labelledby="tv-decision-title">
            <div className="tv-card-head">
              <div className="tv-card-icon">
                <Waves aria-hidden />
              </div>
              <span>{t("overview.decide")}</span>
            </div>
            <h2 id="tv-decision-title">{t("overview.decideTitle")}</h2>
            <p>{t("overview.decideBody")}</p>
            <Link href={exploreHref}>
              {t("overview.decideCta")} <ArrowUpRight aria-hidden size={17} />
            </Link>
          </section>
        </div>

        <section className="tv-field-hero" aria-labelledby="tv-field-hero-title">
          <div className="tv-field-lines" aria-hidden>
            <i />
            <i />
          </div>
          <div className="tv-field-top">
            <span>
              <Layers aria-hidden size={18} /> {t("overview.fieldView")}
            </span>
            <Link href={fieldHref}>
              {t("overview.openMap")} <ArrowUpRight aria-hidden size={17} />
            </Link>
          </div>
          <div className="tv-field-panel">
            <span className="tv-field-label">{field ? t("overview.selected") : t("overview.example")}</span>
            <h2 id="tv-field-hero-title">{field ? t("overview.analysis") : t("overview.demoName")}</h2>
            <p>
              {n(Math.abs(selectedField.lat), 4)}° {selectedField.lat >= 0 ? "N" : "S"}, {n(Math.abs(selectedField.lon), 4)}° {selectedField.lon >= 0 ? "E" : "W"}
              {area !== null && ` · ${n(area, 2)} ${t("unit.ha")}`}
            </p>
            <div className="tv-field-metrics">
              <div>
                <Thermometer aria-hidden />
                <span>{t("overview.temp")}</span>
                <strong>{temperature === null ? "—" : `${n(temperature, 1)}°C`}</strong>
              </div>
              <div>
                <Droplets aria-hidden />
                <span>{t("summary.wetness")}</span>
                <strong>{wetness === null ? "—" : n(wetness, 2)}</strong>
              </div>
              <div>
                <Sprout aria-hidden />
                <span>{t("overview.ndvi")}</span>
                <strong>{ndvi === null ? "—" : n(ndvi, 2)}</strong>
              </div>
            </div>
            {analysis.isError && (
              <button type="button" className="tv-retry" onClick={() => analysis.refetch()}>
                <RefreshCw size={15} aria-hidden />
                {t("state.retry")}
              </button>
            )}
            <div className="tv-field-actions">
              <Link href={fieldHref}>{t("overview.inspect")}</Link>
              <Link href={evidenceHref}>
                {t("nav.evidence")} <ArrowUpRight aria-hidden size={16} />
              </Link>
            </div>
          </div>
          <div className="tv-field-chart">
            <div>
              <strong>{t("overview.rainHistory")}</strong>
              <span>
                {recent[0]?.year ?? "—"}–{recent.at(-1)?.year ?? "—"}
              </span>
            </div>
            <div className="tv-bars" role="img" aria-label={t("overview.rainHistory")}>
              {recent.map((y) => (
                <span key={y.year} title={`${y.year}: ${n(y.precipitation_mm)} mm`} style={{ height: `${Math.max(8, (y.precipitation_mm / maxRain) * 100)}%` }} />
              ))}
            </div>
          </div>
          {source !== "engine" && <span className="tv-hero-demo">{t("source.demo")}</span>}
        </section>
      </div>
    </main>
  );
}
