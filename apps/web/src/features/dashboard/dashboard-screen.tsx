"use client";

import Link from "next/link";
import { ArrowUpRight, CloudSun, Droplets, Layers, MapPinned, RefreshCw, Sprout, Thermometer, Waves } from "lucide-react";
import { useField, useFieldAnalysis } from "@/features/field/use-field";
import { DEMO_FIELD } from "@/lib/api/mock";
import { polygonAreaM2, type LngLat } from "@/lib/geo";
import { writeField, type FieldState } from "@/lib/url-state";
import { useI18n, type MessageKey } from "@/i18n";
import { useDataSource } from "@/lib/api/source";

const exampleField: FieldState = {
  lat: DEMO_FIELD.lat,
  lon: DEMO_FIELD.lon,
  ring: DEMO_FIELD.geometry.coordinates[0].slice(0, -1) as LngLat[],
  irrigated: DEMO_FIELD.irrigated,
};

const average = (values: number[]) => values.length ? values.reduce((total, value) => total + value, 0) / values.length : null;

export function DashboardScreen() {
  const { field } = useField();
  const { n, t } = useI18n();
  const source = useDataSource();
  const selectedField = field ?? exampleField;
  const analysis = useFieldAnalysis(selectedField);
  const fieldAnalysis = analysis.data;
  const climate = fieldAnalysis?.climate ?? [];
  const recentClimate = climate.slice(-12);
  const temperature = average(climate.map((year) => year.mean_temp_c));
  const rainfall = average(climate.map((year) => year.precipitation_mm));
  const et0 = average(climate.map((year) => year.et0_mm));
  const wetness = average(climate.map((year) => year.root_zone_wetness));
  const ndvi = average((fieldAnalysis?.ndvi_history ?? []).map((year) => year.mean_ndvi));
  const area = selectedField.ring ? polygonAreaM2(selectedField.ring) / 10_000 : null;
  const query = writeField(new URLSearchParams(), selectedField).toString();
  const fieldHref = `/app?${query}`;
  const exploreHref = `/app/explore?${query}`;
  const evidenceHref = `/app/evidence?${query}`;
  const maxRainfall = Math.max(1, ...recentClimate.map((year) => year.precipitation_mm));
  const textureKey = `texture.${fieldAnalysis?.soil.texture.toLowerCase()}` as MessageKey;
  const texture = fieldAnalysis ? (t(textureKey) === textureKey ? fieldAnalysis.soil.texture : t(textureKey)) : "—";

  return (
    <main id="main" tabIndex={-1} className="tv-dashboard">
      <div className="tv-dashboard-intro">
        <div><span className="tv-eyebrow">TARLA KARAR MERKEZİ</span><h1>Çiftliğe genel bakış</h1></div>
        <span className="tv-context-chip"><MapPinned size={15} aria-hidden="true" />{field ? "Seçili tarla" : "Örnek tarla"}</span>
      </div>

      <div className="tv-dashboard-grid">
        <div className="tv-dashboard-metrics">
          <section className="tv-card tv-climate" aria-labelledby="tv-climate-title">
            <div className="tv-card-head"><div className="tv-card-icon"><CloudSun aria-hidden="true" /></div><span>İklim geçmişi</span></div>
            <h2 id="tv-climate-title">Yıllık ortalama sıcaklık</h2>
            {temperature === null ? <p className="tv-value-placeholder">{analysis.isError ? "Veri alınamadı" : "Veri yükleniyor"}</p> : (
              <p className="tv-climate-value">{n(temperature, 1)}<span>°C</span></p>
            )}
            <div className="tv-climate-strip" aria-hidden="true"><span /></div>
            <div className="tv-card-foot"><span>{climate[0]?.year ?? "—"}–{climate.at(-1)?.year ?? "—"} dönemi</span><span>İklim verisi</span></div>
          </section>

          <section className="tv-card tv-soil" aria-labelledby="tv-soil-title">
            <div className="tv-card-head"><div className="tv-card-icon green"><Sprout aria-hidden="true" /></div><Link href={fieldHref} aria-label="Tarla sağlığını aç"><ArrowUpRight aria-hidden="true" /></Link></div>
            <h2 id="tv-soil-title">Tarla sağlığı</h2>
            <div className="tv-soil-main">
              <div className="tv-soil-ring" style={{ "--ring-fill": `${Math.round((ndvi ?? 0) * 100)}%` } as React.CSSProperties}><div><strong>{ndvi === null ? "—" : n(ndvi, 2)}</strong><span>NDVI ortalaması</span></div></div>
              <div className="tv-soil-details">
                <div><span>Toprak yapısı</span><strong>{texture}</strong></div>
                <div><span>Toprak pH</span><strong>{fieldAnalysis ? n(fieldAnalysis.soil.ph, 1) : "—"}</strong></div>
                <div><span>Organik karbon</span><strong>{fieldAnalysis ? `${n(fieldAnalysis.soil.organic_carbon, 1)} g/kg` : "—"}</strong></div>
              </div>
            </div>
          </section>

          <section className="tv-card tv-water" aria-labelledby="tv-water-title">
            <div className="tv-card-head"><div className="tv-card-icon blue"><Droplets aria-hidden="true" /></div><span>Su dengesi</span></div>
            <h2 id="tv-water-title">Yağış ve buharlaşma</h2>
            <div className="tv-water-pair">
              <div><span>Yıllık yağış</span><strong>{rainfall === null ? "—" : n(rainfall)} <small>mm</small></strong></div>
              <div><span>Yıllık ET₀</span><strong>{et0 === null ? "—" : n(et0)} <small>mm</small></strong></div>
            </div>
            <div className="tv-water-track" role="img" aria-label={rainfall === null || et0 === null ? "Su dengesi yükleniyor" : `Yağış, buharlaşma ihtiyacının yüzde ${Math.round(rainfall / Math.max(et0, 1) * 100)} kadarı`}><span style={{ width: `${Math.min(100, rainfall === null || et0 === null ? 0 : rainfall / Math.max(et0, 1) * 100)}%` }} /></div>
            <p>{wetness === null ? "Kök bölgesi nemi hesaplanıyor" : `Kök bölgesi ortalama nemi %${n(wetness * 100)}`}</p>
          </section>

          <section className="tv-card tv-decision" aria-labelledby="tv-decision-title">
            <div className="tv-card-head"><div className="tv-card-icon"><Waves aria-hidden="true" /></div><span>Ekim kararı</span></div>
            <h2 id="tv-decision-title">Bir sonraki ekimi planla</h2>
            <p>Su, gelir, toprak ve risk önceliklerine göre yıllık ürün sıralamalarını karşılaştır.</p>
            <Link href={exploreHref}>Ekim önerilerini gör <ArrowUpRight aria-hidden="true" size={17} /></Link>
          </section>
        </div>

        <section className="tv-field-hero" aria-labelledby="tv-field-hero-title">
          <div className="tv-field-picture" />
          <div className="tv-field-lines" aria-hidden="true"><i /><i /></div>
          <div className="tv-field-top">
            <span><Layers aria-hidden="true" size={18} /> Tarla görünümü</span>
            <Link href={fieldHref}>Haritayı aç <ArrowUpRight aria-hidden="true" size={17} /></Link>
          </div>
          <div className="tv-field-panel">
            <span className="tv-field-label">{field ? "SEÇİLİ TARLA" : "ÖRNEK TARLA"}</span>
            <h2 id="tv-field-hero-title">{field ? "Tarla analizi" : "Denizli örnek tarlası"}</h2>
            <p>{n(Math.abs(selectedField.lat), 4)}° K, {n(Math.abs(selectedField.lon), 4)}° D {area !== null && `· ${n(area, 2)} ha`}</p>
            <div className="tv-field-metrics">
              <div><Thermometer aria-hidden="true" /><span>Ortalama sıcaklık</span><strong>{temperature === null ? "—" : `${n(temperature, 1)}°C`}</strong></div>
              <div><Droplets aria-hidden="true" /><span>Toprak nemi</span><strong>{wetness === null ? "—" : `%${n(wetness * 100)}`}</strong></div>
              <div><Sprout aria-hidden="true" /><span>Bitki örtüsü</span><strong>{ndvi === null ? "—" : n(ndvi, 2)}</strong></div>
            </div>
            {analysis.isError && <button type="button" className="tv-retry" onClick={() => analysis.refetch()}><RefreshCw size={15} aria-hidden="true" />Analizi yeniden dene</button>}
            <div className="tv-field-actions"><Link href={fieldHref}>Tarlayı incele</Link><Link href={evidenceHref}>Veri ve yöntem <ArrowUpRight aria-hidden="true" size={16} /></Link></div>
          </div>
          <div className="tv-field-chart">
            <div><strong>Yıllık yağış geçmişi</strong><span>{recentClimate[0]?.year ?? "—"}–{recentClimate.at(-1)?.year ?? "—"}</span></div>
            <div className="tv-bars" role="img" aria-label="Son yılların yağış miktarları">
              {recentClimate.map((year) => <span key={year.year} title={`${year.year}: ${n(year.precipitation_mm)} mm`} style={{ height: `${Math.max(8, year.precipitation_mm / maxRainfall * 100)}%` }} />)}
            </div>
          </div>
          {source !== "engine" && <span className="tv-hero-demo">Örnek veriler</span>}
        </section>
      </div>
    </main>
  );
}
