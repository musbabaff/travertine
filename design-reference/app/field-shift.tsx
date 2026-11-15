"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { ArrowRight, ArrowUpRight, ChevronDown, Database, Droplets, Leaf, SlidersHorizontal, X } from "lucide-react";

type Language = "en" | "tr";
type Screen = "explore" | "evidence" | "field-summary" | "rotation-plan";

export const demoField = {
  id: "saraykoy-demo",
  name: "Sarayköy",
  coordinates: [37.89, 28.98],
  areaHectares: 11.6,
  texture: "Clay loam",
  ph: 6.7,
  carbonGramsPerKg: 16,
  availableWaterMm: 139,
  et0RangeMm: [1145, 1359],
};

const source = { dataset: "Demo tarla verisi", provider: "Travertine", resolution: "Örnek değerler; ölçülmüş ızgara değil", years: "Geri test örneği: 2001–2024", url: "https://power.larc.nasa.gov/" };
export const rotationOptions = [
  { id: "lentil-barley", en: "Winter lentil → Barley", tr: "Kışlık mercimek → Arpa", crops: ["Mercimek", "Arpa", "Mercimek", "Arpa", "Mercimek"], water: .86, income: .61, soil: .88, risk: .78, legume: true },
  { id: "barley-chickpea", en: "Barley → Chickpea", tr: "Arpa → Nohut", crops: ["Arpa", "Nohut", "Arpa", "Nohut", "Arpa"], water: .73, income: .72, soil: .75, risk: .68, legume: true },
  { id: "wheat-barley", en: "Wheat → Barley", tr: "Buğday → Arpa", crops: ["Buğday", "Arpa", "Buğday", "Arpa", "Buğday"], water: .54, income: .79, soil: .49, risk: .56, legume: false },
];

const labels = {
  en: { nav: ["Field", "Decision", "Science"], home: "Home", summary: "Field summary", explore: "Explore rotations", plan: "Rotation plan", evidence: "Evidence", demo: "Demo data", live: "Live engine", fallback: "Demo data — engine unavailable", field: "Demo field · Sarayköy, Denizli", source: "Data source", discover: "Open demo field", priorities: ["Save water", "Income", "Soil health", "Low risk"], years: "Planning horizon", compare: "Compare", details: "View plan", noField: "Choose a field to continue", retry: "Retry" },
  tr: { nav: ["Tarla", "Karar", "Veri"], home: "Ana sayfa", summary: "Tarla sağlığı", explore: "Ekim önerileri", plan: "Ekim planı", evidence: "Veri ve yöntem", demo: "Örnek veri", live: "Canlı motor", fallback: "Örnek veri — motora ulaşılamadı", field: "Örnek tarla · Sarayköy, Denizli", source: "Veri kaynağı", discover: "Tarlayı aç", priorities: ["Su tasarrufu", "Gelir", "Toprak sağlığı", "Düşük risk"], years: "Plan dönemi", compare: "Karşılaştır", details: "Planı gör", noField: "Devam etmek için tarla seçin", retry: "Yeniden dene" },
};

const pageDescriptions: Record<Screen, string> = {
  "field-summary": "Tarlanın toprağını, su durumunu ve saha göstergelerini tek yerde inceleyin.",
  explore: "Önceliklerinizi değiştirin; ürün seçeneklerinin sıralanışını görün.",
  "rotation-plan": "Seçilen ürün sırasını ve yıllara göre ekim planını inceleyin.",
  evidence: "Kullanılan veri kaynaklarını ve yöntemin sınırlarını gözden geçirin.",
};

function SourceChip({ lang }: { lang: Language }) {
  const [open, setOpen] = useState(false);
  return <span className="fs-source-wrap"><button className="fs-source" onClick={() => setOpen(!open)} aria-expanded={open}><Database size={14} />{labels[lang].source}<ChevronDown size={13} /></button>{open && <span className="fs-source-pop"><strong>{source.dataset}</strong><span>{source.provider} · {source.resolution}</span><span>{source.years}</span><a href={source.url} target="_blank" rel="noreferrer">{lang === "en" ? "NASA POWER reference" : "NASA POWER referansı"} <ArrowUpRight size={13} /></a></span>}</span>;
}

function Shell({ screen, children }: { screen: Screen; children: React.ReactNode }) {
  return (
    <div className="fs-shell decision-support-shell">
      <main id="page-content" className={`fs-main decision-support-main fs-${screen}`}>
        {children}
      </main>
    </div>
  );
}

function FieldShiftContent({ screen }: { screen: Screen }) {
  const pathname = usePathname();
  const search = useSearchParams();
  const lang: Language = "tr" as Language;
  const [unit, setUnit] = useState<"ha" | "da">("ha");
  const [weights, setWeights] = useState(() => {
    const parsed = search.get("weights")?.split(",").map(Number);
    return parsed?.length === 4 && parsed.every(value => Number.isFinite(value) && value >= 0 && value <= 100) && parsed.some(Boolean) ? parsed : [60, 50, 70, 55];
  });
  const [years, setYears] = useState(() => Number(search.get("years")) || 3);
  const [selected, setSelected] = useState<string[]>([]);
  const [expanded, setExpanded] = useState<string | null>(null);
  const t = labels[lang];
  const fieldParam = search.get("field") ?? demoField.id;
  const fieldQuery = `field=${encodeURIComponent(fieldParam)}`;
  const area = unit === "ha" ? demoField.areaHectares.toFixed(2) : (demoField.areaHectares * 10).toFixed(1);
  const ranked = rotationOptions.map(option => ({ ...option, score: (option.water * weights[0] + option.income * weights[1] + option.soil * weights[2] + option.risk * weights[3]) / weights.reduce((a,b) => a+b, 0) })).sort((a,b) => b.score-a.score);
  const updateWeights = (index: number, value: number) => {
    const next = weights.map((weight, position) => position === index ? value : weight);
    setWeights(next);
    const params = new URLSearchParams(search.toString());
    params.set("field", fieldParam);
    params.set("weights", next.join(","));
    window.history.replaceState(null, "", `${pathname}?${params}`);
  };
  return <Shell screen={screen}>
    <div className="fs-page-head"><div><span className="fs-kicker">TRAVERTINE / {t.field}</span><h1>{screen === "explore" ? t.explore : screen === "evidence" ? t.evidence : screen === "rotation-plan" ? t.plan : t.summary}</h1><p>{pageDescriptions[screen]}</p></div><SourceChip lang={lang}/></div>
    {screen === "explore" && <div className="fs-explore-layout"><aside className="fs-card fs-controls"><div className="fs-card-head"><SlidersHorizontal size={21}/><h2>{lang === "en" ? "Your priorities" : "Önceliklerin"}</h2></div>{weights.map((weight,index)=><label className="fs-weight" key={index}><span>{t.priorities[index]}<strong>{weight}</strong></span><input type="range" min="0" max="100" value={weight} onChange={event=>updateWeights(index,Number(event.target.value))}/></label>)}<div className="fs-years"><span>{t.years}</span>{[3,4,5].map(value=><button key={value} aria-pressed={years===value} onClick={()=>{setYears(value);const params=new URLSearchParams(search.toString());params.set("years",String(value));params.set("field",fieldParam);window.history.replaceState(null,"",`${pathname}?${params}`);}}>{value}</button>)}</div><p className="fs-note">{lang === "en" ? "Scores below are clearly labelled demo data. The science engine can replace this data source." : "Aşağıdaki puanlar açıkça demo veridir. Bilim motoru bu veri kaynağının yerini alabilir."}</p></aside><div className="fs-rotation-list"><div className="fs-list-head"><span>{lang === "en" ? "RANKED OPTIONS" : "SIRALI SEÇENEKLER"}</span><span>{ranked.length} {lang === "en" ? "rotations" : "rotasyon"}</span></div>{ranked.map((option,index)=><article className="fs-card fs-rotation" key={option.id}><div className="fs-rotation-top"><div><span className="fs-rank">0{index+1}</span><h2>{lang === "en" ? option.en : option.tr}</h2><small>{option.legume ? lang === "en" ? "Includes a legume" : "Baklagil içerir" : lang === "en" ? "No legume" : "Baklagil yok"}</small></div><strong>{option.score.toFixed(2)}</strong></div><div className="fs-timeline">{option.crops.slice(0,years).map((crop,year)=><span key={year}><small>{lang === "en" ? "YEAR" : "YIL"} {year+1}</small>{crop}</span>)}</div><div className="fs-score-grid">{[option.water,option.income,option.soil,option.risk].map((value,metric)=><div key={metric}><span>{t.priorities[metric]} <b>{value.toFixed(2)}</b></span><i><em style={{width:`${value*100}%`}}/></i></div>)}</div><div className="fs-rotation-actions"><button onClick={()=>setExpanded(expanded===option.id?null:option.id)} aria-expanded={expanded===option.id}>{lang === "en" ? "Water detail" : "Su ayrıntısı"}<ChevronDown size={16}/></button><button onClick={()=>setSelected(selected.includes(option.id)?selected.filter(id=>id!==option.id):[...selected.slice(-1),option.id])} aria-pressed={selected.includes(option.id)}>{t.compare}</button><Link href={`/rotation-plan?${fieldQuery}&rotation=${option.id}&years=${years}`}>{t.details}<ArrowRight size={16}/></Link></div>{expanded===option.id&&<div className="fs-water-detail"><p>{lang === "en" ? "Illustrative annual water demand. Connect the science engine for measured and calculated values." : "Örnek yıllık su ihtiyacı. Ölçülen ve hesaplanan değerler için bilim motorunu bağlayın."}</p>{[72,85,67,78,71].slice(0,years).map((height,year)=><i key={year} style={{height:`${height}%`}} title={`${lang === "en" ? "Year" : "Yıl"} ${year+1}`}/>)}</div>}</article>)}{selected.length===2&&<div className="fs-compare-banner">{lang === "en" ? "Comparing" : "Karşılaştırılıyor"}: {selected.map(id=>rotationOptions.find(option=>option.id===id)?.[lang]).join(" · ")} <button onClick={()=>setSelected([])}><X size={16}/></button></div>}</div></div>}
    {screen === "evidence" && <div className="fs-evidence-grid"><section className="fs-card fs-evidence-chart"><div className="fs-card-head"><h2>{lang === "en" ? "Backtest · 2001–2024" : "Geri test · 2001–2024"}</h2><SourceChip lang={lang}/></div><p>{lang === "en" ? "Modelled water stress compared with observed vegetation anomaly" : "Hesaplanan su stresi ve gözlenen bitki örtüsü sapması"}</p><div className="fs-evidence-empty"><Database size={27}/><strong>{lang === "en" ? "Year-by-year series pending" : "Yıllık seri bekleniyor"}</strong><p>{lang === "en" ? "The verified 24-year values will be drawn here when the science engine provides them. No observations are invented for this chart." : "Doğrulanmış 24 yıllık değerler bilim motorundan gelince burada çizilecek. Bu grafik için gözlem uydurulmaz."}</p></div><div className="fs-axis"><span>2001</span><span>{lang === "en" ? "Year" : "Yıl"}</span><span>2024</span></div><div className="fs-legend"><span>{lang === "en" ? "Modelled stress" : "Hesaplanan stres"}</span><span>{lang === "en" ? "Observed anomaly" : "Gözlenen sapma"}</span></div></section><aside className="fs-card fs-evidence-result"><span>{lang === "en" ? "DEMO FIELD · SIMPLE METHOD" : "DEMO TARLA · BASİT YÖNTEM"}</span><strong>−0.48</strong><p>{lang === "en" ? "Correlation over 24 years" : "24 yıllık korelasyon"}</p><hr/><p>{lang === "en" ? "A negative relationship is observed. This is not proof of a perfect model or a future forecast." : "Negatif bir ilişki görülüyor. Bu kusursuz model kanıtı ya da gelecek tahmini değildir."}</p><Link href="/field-summary">{t.summary}<ArrowRight size={17}/></Link></aside></div>}
    {screen === "field-summary" && <><div className="fs-summary-grid"><section className="fs-field-map" id="field-map"><span>{t.field}</span><div><strong>{area} {unit}</strong><span>37.89° N · 28.98° E</span></div></section><div className="fs-summary-metrics"><article className="fs-card"><span>{lang === "en" ? "SOIL TEXTURE" : "TOPRAK BÜNYESİ"}</span><strong>{lang === "en" ? "Clay loam" : "Killi tın"}</strong><p>{lang === "en" ? "Global soil estimate" : "Küresel toprak tahmini"}</p></article><article className="fs-card"><span>pH</span><strong>6.7</strong><p>{lang === "en" ? "Demo field value" : "Demo tarla değeri"}</p></article><article className="fs-card"><span>{lang === "en" ? "ORGANIC CARBON" : "ORGANİK KARBON"}</span><strong>16 <small>g/kg</small></strong><p>{lang === "en" ? "Demo field value" : "Demo tarla değeri"}</p></article><article className="fs-card"><span>{lang === "en" ? "AVAILABLE WATER" : "KULLANILABİLİR SU"}</span><strong>139 <small>mm</small></strong><p>{lang === "en" ? "Global soil estimate" : "Küresel toprak tahmini"}</p></article></div></div><section className="fs-summary-bottom"><div><span>{lang === "en" ? "ANNUAL ET0" : "YILLIK ET0"}</span><strong>1,145–1,359 mm</strong><p>{lang === "en" ? "Demo range. Global soil grids have 250 m resolution and cannot capture variation within this field." : "Demo aralık. Küresel toprak ızgarası 250 m çözünürlüktedir; tarla içindeki farkları göstermez."}</p></div><div className="fs-unit-switch"><button aria-pressed={unit==="ha"} onClick={()=>setUnit("ha")}>ha</button><button aria-pressed={unit==="da"} onClick={()=>setUnit("da")}>da</button></div><Link className="fs-primary" href={`/explore?${fieldQuery}`}>{t.explore}<ArrowRight size={17}/></Link></section></>}
    {screen === "rotation-plan" && <><div className="fs-plan-head"><div><span>{lang === "en" ? "SELECTED ROTATION" : "SEÇİLEN ROTASYON"}</span><h2>{lang === "en" ? rotationOptions.find(o=>o.id===search.get("rotation"))?.en ?? rotationOptions[0].en : rotationOptions.find(o=>o.id===search.get("rotation"))?.tr ?? rotationOptions[0].tr}</h2><p>{t.field} · {years} {lang === "en" ? "years" : "yıl"}</p></div><button className="fs-primary" onClick={()=>window.print()}>{lang === "en" ? "Print / save PDF" : "Yazdır / PDF kaydet"}<ArrowUpRight size={17}/></button></div><div className="fs-plan-years">{rotationOptions.find(o=>o.id===search.get("rotation"))?.crops.slice(0,years).map((crop,index)=><article className="fs-card" key={index}><span>{lang === "en" ? "YEAR" : "YIL"} 0{index+1}</span><h3>{crop}</h3><p>{lang === "en" ? "Sowing and harvest months will come from the crop library." : "Ekim ve hasat ayları ürün kütüphanesinden gelecek."}</p><div><Droplets size={18}/>{lang === "en" ? "Water figures await the science engine" : "Su değerleri bilim motorundan beklenecek"}</div></article>)}</div><section className="fs-plan-warning"><Leaf size={20}/><p>{lang === "en" ? "This plan uses demo crop sequences. Water deficit, stress, yield loss and historical best/worst years are not calculated here." : "Bu plan demo ürün sıralaması kullanır. Su açığı, stres, verim kaybı ve geçmiş en iyi/kötü yıllar burada hesaplanmaz."}</p></section></>}
  </Shell>;
}

export default function FieldShift({ screen }: { screen: Screen }) {
  return <Suspense fallback={<div className="fs-loading" aria-label="Loading" />}><FieldShiftContent screen={screen} /></Suspense>;
}
