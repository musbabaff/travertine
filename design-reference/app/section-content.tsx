"use client";

import Link from "next/link";
import { useRef, useState } from "react";
import {
  Apple,
  Home,
  Layers,
  ChartNoAxesCombined,
  ClipboardList,
  Package,
  User,
  ArrowRight,
  Bell,
  Check,
  ChevronRight,
  CloudSun,
  Droplets,
  Download,
  Grape,
  Cherry,
  Search,
  Settings,
  Sprout,
  Thermometer,
  Trees,
} from "lucide-react";
import { analyticsPages, allPages, monitoringPages } from "./navigation";

export const fields = [
  {
    name: "Elma Bahçesi",
    crop: "Elma",
    area: 18,
    moisture: 64,
    progress: 51.4,
    trees: "8.900",
    icon: Apple,
    color: "apple",
  },
  {
    name: "Üzüm Bağı",
    crop: "Üzüm",
    area: 10,
    moisture: 58,
    progress: 22.5,
    trees: "5.200",
    icon: Grape,
    color: "grape",
  },
  {
    name: "Kiraz Bahçesi",
    crop: "Kiraz",
    area: 12,
    moisture: 71,
    progress: 30.6,
    trees: "6.100",
    icon: Cherry,
    color: "cherry",
  },
];
const weeks = [42, 54, 49, 63, 78, 69, 84];

export default function SectionContent({
  section,
  title,
  description,
}: {
  section: string;
  title: string;
  description: string;
}) {
  const [selectedField, setSelectedField] = useState(0);
  const detailRef = useRef<HTMLDivElement>(null);
  const [irrigation, setIrrigation] = useState(60);
  const [search, setSearch] = useState("");
  const [noticeRead, setNoticeRead] = useState(false);
  const [alerts, setAlerts] = useState(true);
  const [boundaries, setBoundaries] = useState(true);
  const [status, setStatus] = useState("");
  const [reportFilter, setReportFilter] = useState("all");
  const reportFields = fields.filter(
    (row) => reportFilter === "all" || row.crop === reportFilter,
  );
  const field = fields[selectedField];
  const group = monitoringPages.some((page) => page.href === `/${section}`)
    ? monitoringPages
    : analyticsPages.some((page) => page.href === `/${section}`)
      ? analyticsPages
      : [];

  function downloadReport() {
    const csv = [
      "Tarla;Ürün;Alan (Ha);Toprak nemi (%);Hasat ilerlemesi (%)",
      ...reportFields.map(
        (row) =>
          `${row.name};${row.crop};${row.area};${row.moisture};${row.progress}`,
      ),
    ].join("\n");
    const url = URL.createObjectURL(
      new Blob(["\ufeff", csv], { type: "text/csv;charset=utf-8" }),
    );
    const link = document.createElement("a");
    link.href = url;
    link.download = "travertine-rapor.csv";
    link.click();
    URL.revokeObjectURL(url);
    setStatus("Rapor indirildi.");
  }

  return (
    <main id="page-content" className={`section-page section-${section}`}>
      <div className="section-rail" aria-hidden="true" />
      <div className="section-body">
        <div className="section-intro">
          <div>
            <p className="eyebrow">
              TRAVERTINE /{" "}
              {group === monitoringPages
                ? "İZLEME"
                : group === analyticsPages
                  ? "ANALİZLER"
                  : "HESAP"}
            </p>
            <h1>{title}</h1>
            <p>{description}</p>
          </div>
          <span className="demo-badge">Örnek veriler</span>
        </div>
        {group.length > 0 && (
          <nav
            className="section-tabs"
            aria-label={`${group === monitoringPages ? "İzleme" : "Analiz"} sayfaları`}
          >
            {group.map((page) => (
              <Link
                key={page.href}
                href={page.href}
                aria-current={page.href === `/${section}` ? "page" : undefined}
              >
                {page.title}
              </Link>
            ))}
          </nav>
        )}

        {section === "monitoring" && (
          <>
            <div className="section-stats">
              <Stat label="Aktif tarla" value="3" icon={Sprout} />
              <Stat label="Toplam alan" value="40 Ha" icon={Trees} />
              <Stat label="Ortalama nem" value="%64" icon={Droplets} />
            </div>
            <div className="field-overview">
              <div className="field-list">
                <h2>Tarlalar</h2>
                {fields.map((row, index) => (
                  <button
                    key={row.name}
                    className={selectedField === index ? "picked" : ""}
                    aria-pressed={selectedField === index}
                    aria-controls="selected-field-detail"
                    onClick={() => {
                      setSelectedField(index);
                      if (window.matchMedia("(max-width: 760px)").matches) {
                        detailRef.current?.scrollIntoView({
                          block: "start",
                          behavior: window.matchMedia(
                            "(prefers-reduced-motion: reduce)",
                          ).matches
                            ? "instant"
                            : "smooth",
                        });
                      }
                    }}
                  >
                    <span className={`crop-icon ${row.color}`}>
                      <row.icon />
                    </span>
                    <span>
                      <strong>{row.name}</strong>
                      <small>
                        {row.area} Ha · %{row.moisture} toprak nemi
                      </small>
                    </span>
                    <ChevronRight />
                  </button>
                ))}
              </div>
              <div
                className="field-detail"
                id="selected-field-detail"
                ref={detailRef}
              >
                <div className="field-detail-photo" />
                <div className="field-detail-body">
                  <span className="eyebrow">TARLA {selectedField + 2}</span>
                  <h2>{field.name}</h2>
                  <p>
                    {field.area} hektar alan · {field.trees} ağaç
                  </p>
                  <div className="detail-progress">
                    <span>Hasat ilerlemesi</span>
                    <strong>%{field.progress.toLocaleString("tr-TR")}</strong>
                    <i>
                      <b style={{ width: `${field.progress}%` }} />
                    </i>
                  </div>
                  <div className="detail-links">
                    <Link href="/irrigation">
                      Sulamayı görüntüle <ArrowRight />
                    </Link>
                    <Link href="/yield">
                      Verim analizi <ArrowRight />
                    </Link>
                  </div>
                </div>
              </div>
            </div>
          </>
        )}
        {section === "weather" && (
          <>
            <div className="weather-hero">
              <CloudSun size={42} />
              <div>
                <span>Bugün · Çiftlik geneli</span>
                <strong>30°C</strong>
                <p>Güneşli · Nem %64</p>
              </div>
            </div>
            <div className="section-stats">
              <Stat label="En düşük" value="24°C" icon={Thermometer} />
              <Stat label="En yüksek" value="38°C" icon={Thermometer} />
              <Stat label="Toprak nemi" value="%64" icon={Droplets} />
            </div>
            <section className="section-panel">
              <h2>Günlük görünüm</h2>
              <div className="weather-hours">
                {["09.00", "10.00", "11.00", "12.00", "13.00", "14.00"].map(
                  (hour, index) => (
                    <div key={hour}>
                      <span>{hour}</span>
                      <CloudSun />
                      <strong>{[24, 28, 30, 32, 36, 38][index]}°</strong>
                    </div>
                  ),
                )}
              </div>
            </section>
          </>
        )}
        {section === "irrigation" && (
          <>
            <div className="section-stats">
              <Stat
                label="Sulama hızı"
                value={`%${irrigation}`}
                icon={Droplets}
              />
              <Stat label="Sıradaki sulama" value="01.30" icon={CloudSun} />
              <Stat label="Aktif tarla" value={field.name} icon={Sprout} />
            </div>
            <div className="utility-layout irrigation-layout">
            <section className="section-panel narrow">
              <h2>Sulama kontrolü</h2>
              <p className="section-muted">
                Tarla ve hız seçimi bu ekranda örnek olarak çalışır.
              </p>
              <label className="form-field">
                Tarla
                <select
                  value={selectedField}
                  onChange={(event) => {
                    setSelectedField(Number(event.target.value));
                    setStatus("");
                  }}
                >
                  {fields.map((row, index) => (
                    <option key={row.name} value={index}>
                      {row.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="form-field">
                Hız: %{irrigation}
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={irrigation}
                  onChange={(event) => {
                    setIrrigation(Number(event.target.value));
                    setStatus("");
                  }}
                />
              </label>
              <button
                className="primary-action"
                onClick={() =>
                  setStatus(
                    `${field.name} için hız %${irrigation} olarak seçildi.`,
                  )
                }
              >
                Seçimi uygula
              </button>
              {status && (
                <p className="inline-status" role="status">
                  <Check size={16} />
                  {status}
                </p>
              )}
            </section>
            <aside className="irrigation-preview">
              <span className="utility-eyebrow">CANLI KONTROL</span>
              <Droplets size={30} strokeWidth={1.5} />
              <strong>%{irrigation}</strong>
              <p>{field.name} için seçilen sulama hızı</p>
              <div className="irrigation-preview-track"><i style={{ width: `${irrigation}%` }} /></div>
              <div className="irrigation-preview-foot"><span>Toprak nemi</span><b>%{field.moisture}</b></div>
            </aside>
            </div>
          </>
        )}
        {section === "production" && (
          <>
            <div className="section-stats">
              <Stat label="Üretim alanı" value="40 Ha" icon={Sprout} />
              <Stat label="Ürün çeşidi" value="3" icon={Apple} />
              <Stat label="Ağaç sayısı" value="20.200" icon={Trees} />
            </div>
            <section className="section-panel">
              <h2>Ürün dağılımı</h2>
              <div className="production-rows">
                {fields.map((row) => (
                  <div key={row.name}>
                    <span className={`crop-icon ${row.color}`}>
                      <row.icon />
                    </span>
                    <strong>{row.crop}</strong>
                    <span>{row.area} Ha</span>
                    <div className="row-track">
                      <i style={{ width: `${row.progress}%` }} />
                    </div>
                    <b>%{row.progress.toLocaleString("tr-TR")}</b>
                  </div>
                ))}
              </div>
            </section>
          </>
        )}
        {(section === "analytics" || section === "yield") && <AnalyticsBoard />}
        {section === "harvest" && (
          <>
            <div className="section-stats">
              <Stat label="Hasat alanı" value="40 Ha" icon={Sprout} />
              <Stat label="Ürün çeşidi" value="3" icon={Apple} />
              <Stat label="İlerleme" value="%51,4" icon={Check} />
            </div>
            <section className="section-panel">
              <h2>Ürün bazında hasat</h2>
              <div className="harvest-list">
                {fields.map((row) => (
                  <div key={row.name}>
                    <span className={`crop-icon ${row.color}`}>
                      <row.icon />
                    </span>
                    <div>
                      <strong>{row.crop}</strong>
                      <small>
                        {row.name} · {row.area} Ha
                      </small>
                    </div>
                    <div className="row-track">
                      <i style={{ width: `${row.progress}%` }} />
                    </div>
                    <b>%{row.progress.toLocaleString("tr-TR")}</b>
                  </div>
                ))}
              </div>
            </section>
          </>
        )}
        {(section === "production" || section === "harvest") && (
          <section className="field-spotlight">
            <div>
              <span>SAHADAN GÖRÜNÜM</span>
              <h2>Üç tarla, tek bakış.</h2>
              <p>Üretim alanlarının güncel örnek görünümünü incele.</p>
              <Link href="/monitoring">Tarlaları aç <ArrowRight size={18} /></Link>
            </div>
            <div className="field-spotlight-stats">
              <span><Sprout size={17} /> 40 Ha üretim alanı</span>
              <span><Trees size={17} /> 20.200 ağaç</span>
            </div>
          </section>
        )}
        {section === "reports" && (
          <section className="section-panel">
            <div className="panel-heading">
              <div>
                <h2>Çiftlik raporu</h2>
                <p className="section-muted">
                  Tarlaların örnek verilerini CSV olarak indirebilirsiniz.
                </p>
              </div>
              <button className="primary-action" onClick={downloadReport}>
                <Download size={18} /> CSV indir
              </button>
            </div>
            <div className="report-controls">
              <label>
                Tarla filtresi
                <select
                  value={reportFilter}
                  onChange={(event) => {
                    setReportFilter(event.target.value);
                    setStatus("");
                  }}
                >
                  <option value="all">Tüm tarlalar</option>
                  {fields.map((row) => (
                    <option key={row.crop}>{row.crop}</option>
                  ))}
                </select>
              </label>
              <span>{reportFields.length} tarla listeleniyor</span>
            </div>
            <div className="report-table">
              <div className="table-head">
                <span>Tarla</span>
                <span>Ürün</span>
                <span>Alan</span>
                <span>Nem</span>
                <span>İlerleme</span>
              </div>
              {reportFields.map((row) => (
                <div key={row.name}>
                  <strong>{row.name}</strong>
                  <span>{row.crop}</span>
                  <span>{row.area} Ha</span>
                  <span>%{row.moisture}</span>
                  <span>%{row.progress.toLocaleString("tr-TR")}</span>
                </div>
              ))}
            </div>
            {status && (
              <p role="status" className="inline-status">
                <Check size={16} />
                {status}
              </p>
            )}
          </section>
        )}
        {section === "notifications" && (
          <div className="utility-layout">
          <section className="section-panel notification-panel">
            <div className="panel-heading">
              <div>
                <h2>Son bildirimler</h2>
                <p className="section-muted">Çiftlikteki son değişiklikler tek yerde.</p>
              </div>
              <button
                className="quiet-action"
                onClick={() => setNoticeRead(true)}
                disabled={noticeRead}
              >
                {noticeRead ? "Okundu" : "Tümünü okundu işaretle"}
              </button>
            </div>
            <div className={`notification-row ${noticeRead ? "read" : ""}`}>
              <Bell />
              <div>
                <strong>Sulama planı güncel</strong>
                <p>Elma Bahçesi için sonraki sulama bugün 01.30.</p>
              </div>
              {!noticeRead && <i />}
            </div>
            <div className="notification-row read">
              <CloudSun />
              <div>
                <strong>Hava tahmini hazır</strong>
                <p>Günlük görünüm ve saatlik sıcaklıklar güncellendi.</p>
              </div>
              <Link href="/weather" aria-label="Hava durumunu aç"><ArrowRight size={18} /></Link>
            </div>
            <div className="notification-row read">
              <ChartNoAxesCombined />
              <div>
                <strong>Haftalık verim özeti</strong>
                <p>Ürünlerin son 7 haftalık örnek performansını incele.</p>
              </div>
              <Link href="/analytics" aria-label="Verim analizini aç"><ArrowRight size={18} /></Link>
            </div>
          </section>
          <aside className="utility-aside">
            <span className="utility-eyebrow">GÜNÜN GÖRÜNÜMÜ</span>
            <Bell size={30} strokeWidth={1.5} />
            <strong>{noticeRead ? "Hepsi okundu" : "1 yeni bildirim"}</strong>
            <p>Tarla, hava ve verim gelişmelerini buradan takip et.</p>
            <Link href="/monitoring">Tarlalara git <ArrowRight size={17} /></Link>
          </aside>
          </div>
        )}
        {section === "settings" && (
          <div className="utility-layout">
          <section className="section-panel settings-panel">
            <h2>Görünüm ve bildirimler</h2>
            <p className="section-muted">Tercihleri değiştirerek önizlemeye bak.</p>
            <label className="setting-line">
              <span>
                <strong>Tarla sınırları</strong>
                <small>Harita görünümünde sınırları göster</small>
              </span>
              <input
                type="checkbox"
                checked={boundaries}
                onChange={(event) => setBoundaries(event.target.checked)}
              />
            </label>
            <label className="setting-line">
              <span>
                <strong>Bildirimler</strong>
                <small>Çiftlik uyarılarını göster</small>
              </span>
              <input
                type="checkbox"
                checked={alerts}
                onChange={(event) => setAlerts(event.target.checked)}
              />
            </label>
            <p className="section-muted">Değişiklikler önizlemede anında görünür.</p>
          </section>
          <aside className="settings-preview">
            <div className="settings-preview-image">
              <span>GÖRÜNÜM ÖNİZLEMESİ</span>
              {boundaries && <i className="preview-boundary" />}
              <div className="preview-field"><Apple size={17} /> Elma Bahçesi</div>
            </div>
            <div className="settings-preview-footer">
              <span><Layers size={17} /> Tarla sınırları <strong>{boundaries ? "Açık" : "Kapalı"}</strong></span>
              <span><Bell size={17} /> Bildirimler <strong>{alerts ? "Açık" : "Kapalı"}</strong></span>
            </div>
          </aside>
          </div>
        )}
        {section === "profile" && (
          <section className="section-panel narrow profile-panel">
            <h2>Çiftlik Yöneticisi</h2>
            <p>Travertine çiftliği</p>
            <div className="section-stats">
              <Stat label="Tarla" value="3" icon={Sprout} />
              <Stat label="Alan" value="40 Ha" icon={Trees} />
            </div>
            <Link className="primary-action" href="/settings">
              <Settings size={18} /> Ayarlara git
            </Link>
          </section>
        )}
        {section === "search" && (
          <section className="section-panel narrow">
            <label className="form-field">
              Tarla veya sayfa ara
              <input
                autoFocus
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Tarla, hava durumu, rapor..."
              />
            </label>
            <div className="search-page-results">
              {fields
                .filter((row) =>
                  row.name
                    .toLocaleLowerCase("tr")
                    .includes(search.toLocaleLowerCase("tr")),
                )
                .map((row) => (
                  <Link key={row.name} href="/monitoring">
                    <Sprout />
                    {row.name}
                    <ChevronRight />
                  </Link>
                ))}
              {allPages
                .filter((page) =>
                  page.title
                    .toLocaleLowerCase("tr")
                    .includes(search.toLocaleLowerCase("tr")),
                )
                .map((page) => (
                  <Link key={page.href} href={page.href}>
                    <Search />
                    {page.title}
                    <ChevronRight />
                  </Link>
                ))}
              {search &&
                !fields.some((row) =>
                  row.name
                    .toLocaleLowerCase("tr")
                    .includes(search.toLocaleLowerCase("tr")),
                ) &&
                !allPages.some((page) =>
                  page.title
                    .toLocaleLowerCase("tr")
                    .includes(search.toLocaleLowerCase("tr")),
                ) && <p>Sonuç bulunamadı.</p>}
            </div>
          </section>
        )}
      </div>
    </main>
  );
}

function AnalyticsBoard() {
  return (
    <div className="analysis-layout">
      <aside className="analysis-metrics">
        <section className="section-panel area-card">
          <div className="panel-heading">
            <h2>Ürün dağılımı</h2>
            <Link
              className="small-round"
              href="/production"
              aria-label="Ürün dağılımı ayrıntıları"
            >
              <ArrowRight size={18} />
            </Link>
          </div>
          <div className="area-gauge">
            <svg
              viewBox="0 0 300 170"
              role="img"
              aria-label="40 hektar toplam alan"
            >
              <defs>
                <linearGradient id="area-spectrum">
                  <stop stopColor="#8bff35" />
                  <stop offset=".5" stopColor="#f9f64a" />
                  <stop offset="1" stopColor="#ff5947" />
                </linearGradient>
              </defs>
              <path
                d="M 15 155 A 135 135 0 0 1 285 155"
                stroke="url(#area-spectrum)"
                strokeWidth="23"
                fill="none"
              />
            </svg>
            <div>
              <strong>40</strong>
              <span>Hektar alan</span>
            </div>
          </div>
          <div className="area-crops">
            {fields.map((row) => (
              <Link key={row.crop} href="/production">
                <span className={`crop-icon ${row.color}`}>
                  <row.icon />
                </span>
                <span>{row.crop}</span>
                <strong>
                  {row.area}
                  <small> Ha</small>
                </strong>
              </Link>
            ))}
          </div>
        </section>
        <section className="analysis-orchard">
          <span className="orchard-tag">
            <Sprout size={15} /> Çiftliğin görünümü
          </span>
          <div>
            <h2>3 tarla. Tek görünüm.</h2>
            <p>Üretim alanlarını birlikte takip et.</p>
            <Link href="/monitoring">
              Tarlaları incele <ArrowRight size={17} />
            </Link>
          </div>
        </section>
      </aside>
      <div className="analysis-detail">
        <section className="section-panel">
          <div className="panel-heading">
            <div>
              <h2>Verim performansı</h2>
              <p className="section-muted">
                Ürün ve hafta seçerek karşılaştır.
              </p>
            </div>
            <span className="period-chip">7 haftalık görünüm</span>
          </div>
          <YieldTrend />
        </section>
        <div className="analysis-bottom">
          <section className="section-panel moisture-card">
            <div className="panel-heading">
              <h2>Toprak nemi</h2>
              <Droplets size={21} />
            </div>
            <div className="moisture-value">
              <strong>
                64<small>%</small>
              </strong>
              <span>Çiftlik ortalaması</span>
            </div>
            <div className="moisture-bars">
              {fields.map((row) => (
                <div key={row.crop}>
                  <span>{row.crop}</span>
                  <i>
                    <b style={{ width: `${row.moisture}%` }} />
                  </i>
                  <strong>%{row.moisture}</strong>
                </div>
              ))}
            </div>
            <Link href="/irrigation">
              Sulama kontrolüne git <ArrowRight size={17} />
            </Link>
          </section>
          <section className="section-panel harvest-summary">
            <div className="panel-heading">
              <h2>Hasat ilerlemesi</h2>
              <Link
                className="small-round"
                href="/harvest"
                aria-label="Hasat ayrıntıları"
              >
                <ArrowRight size={17} />
              </Link>
            </div>
            <div className="harvest-ring">
              <svg
                viewBox="0 0 180 180"
                aria-label="Elma hasadı yüzde 51,4"
                role="img"
              >
                <circle
                  cx="90"
                  cy="90"
                  r="72"
                  fill="none"
                  stroke="#f1f2ed"
                  strokeWidth="14"
                />
                <circle
                  cx="90"
                  cy="90"
                  r="72"
                  fill="none"
                  stroke="#b6ed43"
                  strokeWidth="14"
                  strokeDasharray="232.5 452.4"
                  transform="rotate(-90 90 90)"
                  strokeLinecap="round"
                />
              </svg>
              <div>
                <strong>
                  51,4<small>%</small>
                </strong>
                <span>Elma Bahçesi</span>
              </div>
            </div>
            <div className="ring-key">
              <i />
              Tamamlanan <span>18 Ha üretim alanı</span>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}

function YieldTrend() {
  const [activeWeek, setActiveWeek] = useState(4);
  const [product, setProduct] = useState(0);
  const values = weeks.map((value) =>
    Math.round(value * [1, 0.72, 0.86][product]),
  );
  const points = values
    .map((value, index) => `${48 + index * 100},${220 - value * 2}`)
    .join(" ");
  return (
    <div className="yield-explorer">
      <div className="trend-toolbar">
        <div className="product-segments" aria-label="Grafik ürünü">
          {fields.map((row, index) => (
            <button
              key={row.crop}
              aria-pressed={product === index}
              onClick={() => setProduct(index)}
            >
              <row.icon size={16} />
              {row.crop}
            </button>
          ))}
        </div>
        <span className="chart-legend">
          <i />
          Verim endeksi
        </span>
      </div>
      <div className="trend-grid">
        <div className="trend-plot">
          <div className="trend-axis" aria-hidden="true">
            {[90, 60, 30, 0].map((tick, index) => (
              <span key={tick} style={{ top: `${16 + index * 24}%` }}>
                {tick}
              </span>
            ))}
          </div>
          <svg
            viewBox="0 0 700 250"
            preserveAspectRatio="none"
            role="img"
            aria-label={`${fields[product].crop} haftalık verim endeksi`}
          >
            <defs>
              <linearGradient id="trend-fill" x1="0" y1="0" x2="0" y2="1">
                <stop stopColor="#a0cf6d" stopOpacity=".35" />
                <stop offset="1" stopColor="#a0cf6d" stopOpacity="0" />
              </linearGradient>
            </defs>
            {[40, 100, 160, 220].map((y) => (
              <g key={y}>
                <line
                  x1="35"
                  x2="680"
                  y1={y}
                  y2={y}
                  stroke="#e3e9df"
                  strokeDasharray="3 6"
                />
              </g>
            ))}
            <polygon
              points={`48,220 ${points} 648,220`}
              fill="url(#trend-fill)"
            />
            <polyline
              points={points}
              fill="none"
              stroke="#609c43"
              strokeWidth="3"
              strokeLinejoin="round"
              vectorEffect="non-scaling-stroke"
            />
            <line
              x1={48 + activeWeek * 100}
              x2={48 + activeWeek * 100}
              y1="20"
              y2="220"
              stroke="#9bb78a"
              strokeDasharray="4 5"
            />
            {values.map((value, index) => (
              <circle
                key={index}
                cx={48 + index * 100}
                cy={220 - value * 2}
                r={activeWeek === index ? 7 : 4}
                fill={activeWeek === index ? "#c8ee62" : "#fff"}
                stroke="#609c43"
                strokeWidth="2"
              />
            ))}
          </svg>
          <div className="week-selector">
            {values.map((value, index) => (
              <button
                key={index}
                aria-label={`${index + 1}. hafta`}
                aria-pressed={activeWeek === index}
                onClick={() => setActiveWeek(index)}
              >
                H{index + 1}
              </button>
            ))}
          </div>
        </div>
        <div className="trend-summary" aria-live="polite">
          <span>{fields[product].name}</span>
          <strong>
            {values[activeWeek]}
            <small>/100</small>
          </strong>
          <p>{activeWeek + 1}. hafta verim endeksi</p>
          <div className="mini-columns">
            {values.map((value, index) => (
              <i
                key={index}
                style={{
                  height: `${value}%`,
                  opacity: index === activeWeek ? 1 : 0.35,
                }}
              />
            ))}
          </div>
          <small>Örnek tahmin serisi</small>
        </div>
      </div>
    </div>
  );
}

function Stat({
  label,
  value,
  icon: Icon,
}: {
  label: string;
  value: string;
  icon: typeof Sprout;
}) {
  return (
    <div className="stat-card">
      <span>
        <Icon size={19} />
        {label}
      </span>
      <strong>{value}</strong>
    </div>
  );
}
