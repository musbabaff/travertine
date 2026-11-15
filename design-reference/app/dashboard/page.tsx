"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import {
  Apple,
  ArrowLeft,
  ArrowUpRight,
  Check,
  ChevronDown,
  Droplets,
  Layers,
  Maximize,
  RefreshCw,
  Search,
  Sprout,
  Thermometer,
  Trees,
  X,
  Grape,
  Cherry,
} from "lucide-react";

const crops = [
  {
    name: "Elma",
    orchard: "Elma Bahçesi",
    share: "51,4",
    area: 18,
    trees: "8.900",
    moisture: 64,
    icon: Apple,
    color: "apple",
  },
  {
    name: "Üzüm",
    orchard: "Üzüm Bağı",
    share: "22,5",
    area: 10,
    trees: "5.200",
    moisture: 58,
    icon: Grape,
    color: "grape",
  },
  {
    name: "Kiraz",
    orchard: "Kiraz Bahçesi",
    share: "30,6",
    area: 12,
    trees: "6.100",
    moisture: 71,
    icon: Cherry,
    color: "cherry",
  },
];
export default function Dashboard() {
  const [cropIndex, setCropIndex] = useState(0);
  const [irrigation, setIrrigation] = useState(60);
  const [period, setPeriod] = useState("Bugün");
  const router = useRouter();
  const pathname = usePathname();
  const [dialog, setDialog] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [layers, setLayers] = useState(true);
  const [expanded, setExpanded] = useState(false);
  const [updated, setUpdated] = useState(false);
  const [week, setWeek] = useState(5);
  const mobileView = "field";
  const modalRef = useRef<HTMLElement>(null);
  const crop = crops[cropIndex];
  const CropIcon = crop.icon;
  const temperature = period === "Bugün" ? 30 : 28;

  useEffect(() => {
    if (!dialog && !expanded) return;
    const previousOverflow = document.body.style.overflow;
    const previousFocus = document.activeElement as HTMLElement | null;
    document.body.style.overflow = "hidden";
    function closeOverlay(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setDialog(null);
        setExpanded(false);
      }
      if (event.key !== "Tab" || !dialog) return;
      const controls = modalRef.current?.querySelectorAll<HTMLElement>(
        'button, input, select, a[href], [tabindex="0"]',
      );
      if (!controls?.length) return;
      const first = controls[0];
      const last = controls[controls.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      }
      if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }
    document.addEventListener("keydown", closeOverlay);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", closeOverlay);
      previousFocus?.focus();
    };
  }, [dialog, expanded]);

  function openSection(name: string) {
    const destinations: Record<string, string> = {
      "Ana sayfa": "/",
      "Tarla izleme": "/monitoring",
      "Hava durumu": "/weather",
      Üretim: "/production",
      Hasat: "/harvest",
      Raporlar: "/reports",
      Bildirimler: "/notifications",
      Menü: "/monitoring",
      Ayarlar: "/settings",
      Analizler: "/analytics",
      Sulama: "/irrigation",
    };
    const destination = destinations[name] ?? "/";
    if (pathname !== destination) router.push(destination);
  }

  return (
    <div id="page-content" className={`dashboard mobile-${mobileView}`}>
      <div className="mobile-toolbar">
        <div>
          <span className="eyebrow">ÇİFTLİK YÖNETİMİ</span>
          <h1>Çiftliğe genel bakış</h1>
        </div>
        <label className="small-select">
          <select
            aria-label="Mobil tarih aralığı"
            value={period}
            onChange={(e) => setPeriod(e.target.value)}
          >
            <option>Bugün</option>
            <option>Yarın</option>
          </select>
          <ChevronDown size={16} />
        </label>
      </div>
      <div className="mobile-crops" aria-label="Mobil tarla seçimi">
        {crops.map(({ name, icon: Icon }, index) => (
          <button
            key={name}
            aria-pressed={cropIndex === index}
            onClick={() => {
              setCropIndex(index);
              setUpdated(false);
            }}
          >
            <Icon size={17} />
            {name}
          </button>
        ))}
      </div>

      <div className="workspace">
        <aside className="sidebar" aria-hidden="true" />

        <main className="metrics">
          <section className="card weather" aria-labelledby="weather-title">
            <div className="card-heading">
              <h2 id="weather-title">Hava Durumu</h2>
              <label className="small-select">
                <select
                  aria-label="Hava durumu günü"
                  value={period}
                  onChange={(e) => setPeriod(e.target.value)}
                >
                  <option>Bugün</option>
                  <option>Yarın</option>
                </select>
                <ChevronDown size={15} />
              </label>
            </div>
            <div className="temperatures">
              <span>24°</span>
              <span>28°</span>
              <strong>
                {temperature}°<small>C</small>
              </strong>
              <span>32°</span>
              <span>36°</span>
              <span>38°</span>
            </div>
            <div className="temperature-scale">
              <div className="heat-strip" />
              <div className="temperature-marker">
                <i />
              </div>
            </div>
            <div className="hours">
              {["09.00", "10.00", "11.00", "12.00", "13.00", "14.00"].map(
                (hour) => (
                  <span
                    className={hour === "11.00" ? "current" : ""}
                    key={hour}
                  >
                    {hour}
                  </span>
                ),
              )}
            </div>
          </section>

          <section
            className="card production"
            aria-labelledby="production-title"
          >
            <div className="card-heading">
              <h2 id="production-title">Ürün Dağılımı</h2>
              <button
                className="small-round"
                aria-label="Üretim detayları"
                onClick={() => openSection("Üretim")}
              >
                <ArrowUpRight />
              </button>
            </div>
            <div className="gauge">
              <svg
                viewBox="0 0 300 160"
                role="img"
                aria-label="Toplam 40 hektar üretim alanı"
              >
                <defs>
                  <linearGradient id="harvest-gradient">
                    <stop stopColor="#88fa35" />
                    <stop offset=".5" stopColor="#f7fb42" />
                    <stop offset="1" stopColor="#ff5946" />
                  </linearGradient>
                </defs>
                <path
                  d="M 13 153 A 137 137 0 0 1 287 153"
                  fill="none"
                  stroke="url(#harvest-gradient)"
                  strokeWidth="24"
                />
              </svg>
              <div className="gauge-label">
                <strong>40</strong>
                <span>Hektar Alan</span>
              </div>
            </div>
            <div className="crop-list">
              {crops.map(({ name, share, area, icon: Icon, color }, index) => (
                <button
                  key={name}
                  onClick={() => {
                    setCropIndex(index);
                    setUpdated(false);
                  }}
                  aria-label={`${name} tarlasını görüntüle`}
                >
                  <span className={`crop-icon ${color}`}>
                    <Icon />
                  </span>
                  <span className="crop-name">{name}</span>
                  <span className="crop-share">%{share}</span>
                  <span className="crop-area">
                    {area} <em>Ha</em>
                  </span>
                </button>
              ))}
            </div>
          </section>

          <section className="card irrigation">
            <div className="water-icon">
              <Droplets />
            </div>
            <div className="irrigation-content">
              <div className="card-heading">
                <h2>Sulama Kontrolü</h2>
                <strong>%{irrigation}</strong>
              </div>
              <div className="slider-row">
                <span>Yavaş</span>
                <input
                  aria-label="Sulama hızı"
                  type="range"
                  min="0"
                  max="100"
                  value={irrigation}
                  onChange={(e) => setIrrigation(Number(e.target.value))}
                  style={{
                    background: `linear-gradient(to right, #2c8d50 ${irrigation}%, #e4e4e4 ${irrigation}%)`,
                  }}
                />
                <span>Hızlı</span>
              </div>
            </div>
          </section>
          <section className="card decision-card" aria-labelledby="decision-title">
            <div className="card-heading">
              <h2 id="decision-title">Ekim Kararı</h2>
              <span className="decision-demo">Demo veri</span>
            </div>
            <p>Su, gelir ve toprak önceliklerine göre ürün seçeneklerini karşılaştır.</p>
            <div className="decision-actions">
              <button onClick={() => router.push("/explore")}>Ekim önerilerini gör <ArrowUpRight size={16} /></button>
              <button onClick={() => router.push("/evidence")}>Veri ve yöntemi incele <ArrowUpRight size={16} /></button>
            </div>
          </section>
        </main>

        <section
          className={`field ${expanded ? "expanded" : ""} ${layers ? "" : "hide-layers"}`}
          aria-label="Tarla haritası"
        >
          <div className="field-photo" />
          <div className="field-shade" />
          <svg
            className="field-boundaries"
            viewBox="0 0 700 756"
            preserveAspectRatio="none"
            aria-hidden="true"
          >
            <path d="M-40 325 L740 75 M-40 665 L740 415" />
            <circle cx="398" cy="185" r="9" />
          </svg>
          <header className="field-header">
            <div className="field-title">
              <button
                className="glass-round"
                aria-label="Önceki tarla"
                onClick={() => {
                  setCropIndex((cropIndex + 2) % 3);
                  setUpdated(false);
                }}
              >
                <ArrowLeft />
              </button>
              <h1>Tarla {cropIndex + 2}</h1>
            </div>
            <div className="field-tools">
              <button
                className="glass-round"
                aria-label="Haritada ara"
                onClick={() => setDialog("Tarla ara")}
              >
                <Search />
              </button>
              <button
                className={`glass-round ${layers ? "" : "off"}`}
                aria-label="Tarla sınırlarını göster"
                aria-pressed={layers}
                onClick={() => setLayers(!layers)}
              >
                <Layers />
              </button>
              <button
                className="glass-round"
                aria-label={expanded ? "Haritayı küçült" : "Haritayı büyüt"}
                onClick={() => setExpanded(!expanded)}
              >
                {expanded ? <X /> : <Maximize />}
              </button>
            </div>
          </header>

          <article className="orchard-panel glass-panel">
            <div className="orchard-heading">
              <span className={`crop-icon ${crop.color}`}>
                <CropIcon />
              </span>
              <div>
                <h2>{crop.orchard}</h2>
                <p>
                  {updated
                    ? "Az önce güncellendi"
                    : "Son güncelleme 1 saat önce"}
                </p>
              </div>
              <button
                aria-label="Tarla verilerini yenile"
                className="refresh"
                onClick={() => setUpdated(true)}
              >
                {updated ? <Check /> : <RefreshCw />}
              </button>
            </div>
            <div className="yield-label">
              <span>Hasat İlerlemesi</span>
              <strong>%{crop.share}</strong>
            </div>
            <div className="yield-progress">
              <span style={{ width: `${crop.share.replace(",", ".")}%` }} />
            </div>
            <dl className="field-stats">
              <div>
                <dt>
                  <Droplets /> Nem
                </dt>
                <dd>%{crop.moisture}</dd>
              </div>
              <div>
                <dt>
                  <Trees /> Ağaç
                </dt>
                <dd>{crop.trees}</dd>
              </div>
              <div>
                <dt>
                  <Thermometer /> Isı
                </dt>
                <dd>{temperature}°C</dd>
              </div>
            </dl>
            <p className="next-irrigation">
              Sonraki sulama: <strong>{period} · 01.30</strong>
            </p>
            <button
              className="analytics-button"
              onClick={() => openSection("Analizler")}
            >
              Analizleri Görüntüle
            </button>
          </article>

          <div className="field-charts">
            <article className="glass-panel chart-card">
              <div className="card-heading">
                <h2>Sulama Durumu</h2>
                <button
                  className="small-round"
                  aria-label="Sulama raporu"
                  onClick={() => openSection("Sulama")}
                >
                  <ArrowUpRight />
                </button>
              </div>
              <div
                className="irrigation-chart"
                role="img"
                aria-label={`Sulama hızı yüzde ${irrigation}`}
              >
                {[29, 38, 51, 31, 53, 43, 35, 62, 50, 74, 37, 61, 44, 27].map(
                  (position, index) => (
                    <div key={index}>
                      <i
                        style={{
                          top: `${position}%`,
                          background:
                            index < 3
                              ? "#40d737"
                              : index < 8
                                ? "#c6e539"
                                : "#da952c",
                          opacity: irrigation === 0 ? 0.2 : 1,
                        }}
                      />
                    </div>
                  ),
                )}
              </div>
            </article>
            <article className="glass-panel chart-card forecast">
              <div className="card-heading">
                <h2>Verim Tahmini</h2>
                <button
                  className="small-round"
                  aria-label="Verim raporu"
                  onClick={() => openSection("Hasat")}
                >
                  <ArrowUpRight />
                </button>
              </div>
              <div className="forecast-chart">
                {Array.from({ length: 7 }, (_, group) => (
                  <button
                    key={group}
                    className={week === group + 1 ? "chosen" : ""}
                    aria-label={`${group + 1}. hafta verim tahmini`}
                    onClick={() => setWeek(group + 1)}
                  >
                    <span className="bars">
                      {Array.from({ length: 18 }, (_, bar) => (
                        <i
                          key={bar}
                          style={{
                            height: `${26 + ((bar * 17 + group * 29) % 68)}%`,
                            background:
                              bar === 1
                                ? "#c6e535"
                                : bar === 3
                                  ? "#a0cd75"
                                  : bar === 5
                                    ? "#df9a43"
                                    : "rgba(236,236,215,.23)",
                          }}
                        />
                      ))}
                    </span>
                    <span className="week-label">H{group + 1}</span>
                  </button>
                ))}
              </div>
            </article>
          </div>
        </section>
      </div>

      {dialog && (
        <div className="modal-backdrop" onClick={() => setDialog(null)}>
          <section
            ref={modalRef}
            className="modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="dialog-title"
            onClick={(e) => e.stopPropagation()}
            onKeyDown={(e) => {
              if (e.key === "Escape") setDialog(null);
            }}
          >
            <header>
              <h2 id="dialog-title">{dialog}</h2>
              <button
                className="small-round"
                autoFocus
                aria-label="Kapat"
                onClick={() => setDialog(null)}
              >
                <X />
              </button>
            </header>
            {dialog === "Tarla ara" ? (
              <>
                <input
                  className="search-input"
                  aria-label="Tarla adı"
                  placeholder="Elma, üzüm veya kiraz ara"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                />
                <div className="search-results">
                  {crops
                    .filter((entry) =>
                      entry.orchard
                        .toLocaleLowerCase("tr")
                        .includes(query.toLocaleLowerCase("tr")),
                    )
                    .map((entry) => (
                      <button
                        key={entry.name}
                        onClick={() => {
                          setCropIndex(crops.indexOf(entry));
                          setDialog(null);
                          setQuery("");
                        }}
                      >
                        <Sprout />
                        <span>{entry.orchard}</span>
                        <span>{entry.area} Ha</span>
                        <ArrowUpRight />
                      </button>
                    ))}
                  {!crops.some((entry) =>
                    entry.orchard
                      .toLocaleLowerCase("tr")
                      .includes(query.toLocaleLowerCase("tr")),
                  ) && <p>Bu adla eşleşen tarla bulunamadı.</p>}
                </div>
              </>
            ) : dialog === "Bildirimler" ? (
              <div className="notice">
                <Check />
                <div>
                  <h3>Sulama planı güncel</h3>
                  <p>{crop.orchard} için sonraki sulama bugün 01.30.</p>
                  <small>
                    Görüntülenen değerler örnek çiftlik verileridir.
                  </small>
                </div>
              </div>
            ) : dialog === "Profil" ? (
              <div className="profile-detail">
                <h3>Çiftlik Yöneticisi</h3>
                <p>Travertine · 3 tarla · 40 hektar</p>
              </div>
            ) : dialog === "Ayarlar" ? (
              <>
                <p>Görünüm ayarları</p>
                <label className="setting-row">
                  Tarla sınırları
                  <input
                    type="checkbox"
                    checked={layers}
                    onChange={(e) => setLayers(e.target.checked)}
                  />
                </label>
                <p className="muted">
                  Bu oturumdaki seçimler sayfa yenilendiğinde sıfırlanır.
                </p>
              </>
            ) : (
              <>
                <p className="muted">
                  {crop.orchard} · {period} · Örnek çiftlik verileri
                </p>
                <div className="report-grid">
                  <div>
                    <span>Üretim alanı</span>
                    <strong>{crop.area} Ha</strong>
                  </div>
                  <div>
                    <span>Hasat ilerlemesi</span>
                    <strong>%{crop.share}</strong>
                  </div>
                  <div>
                    <span>Toprak nemi</span>
                    <strong>%{crop.moisture}</strong>
                  </div>
                  <div>
                    <span>Sulama hızı</span>
                    <strong>%{irrigation}</strong>
                  </div>
                </div>
                <p className="report-note">
                  {week}. hafta tahmini görüntüleniyor. Sıcaklık {temperature}
                  °C; sonraki sulama {period.toLocaleLowerCase("tr")} 01.30.
                </p>
              </>
            )}
          </section>
        </div>
      )}
    </div>
  );
}
