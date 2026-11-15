import type { Locale } from "@/i18n";
import type { Validation } from "@/lib/api/types";

const cropNames: Record<string, string> = {
  winter_wheat: "Kışlık buğday",
  barley: "Arpa",
  lentil: "Mercimek",
  faba_bean: "Kuru bakla",
  maize: "Danelik mısır",
  sorghum: "Danelik sorgum",
  cotton: "Pamuk",
  sunflower: "Ayçiçeği",
  sugar_beet: "Şeker pancarı",
  tomato: "Domates",
  soybean: "Soya",
  alfalfa: "Yonca",
};

export function cropLabel(id: string, original: string, locale: Locale) {
  return locale === "tr" ? cropNames[id] ?? original : original;
}

function nameFromEnglish(name: string) {
  const entry = Object.entries(cropNames).find(([id]) => id.replace(/_/g, " ") === name.toLowerCase());
  if (entry) return entry[1];
  const names: Record<string, string> = {
    "winter wheat": "kışlık buğday",
    barley: "arpa",
    lentil: "mercimek",
    "faba bean (dry)": "kuru bakla",
    "maize (grain)": "danelik mısır",
    "sorghum (grain)": "danelik sorgum",
    cotton: "pamuk",
    sunflower: "ayçiçeği",
    "sugar beet": "şeker pancarı",
    tomato: "domates",
    soybean: "soya",
    "alfalfa (hay)": "yonca",
  };
  return names[name.toLowerCase()] ?? name;
}

export function explanationText(line: string, locale: Locale) {
  if (locale !== "tr") return line;
  const deficit = line.match(/^Estimated water deficit over (\d+) years: (\d+) mm under rain-fed conditions, using the (.+) climate at this location\.$/);
  if (deficit) return `${deficit[1]} yıldaki tahmini su açığı ${deficit[2]} mm. Hesap, bu konumdaki ${deficit[3]} iklimine ve yağışa dayalı koşullara dayanır.`;
  const legume = line.match(/^Includes (\d+) legume year \((.+)\), which fix nitrogen for the following crop\.$/);
  if (legume) return `${legume[2].split(", ").map(nameFromEnglish).join(", ")} içeren ${legume[1]} baklagil yılı, sonraki ürün için toprağa azot sağlar.`;
  if (line.startsWith("Includes no legume")) return "Dizide baklagil yok; her yıl azot gereksinimi gübreyle karşılanmalıdır.";
  if (line.startsWith("No crop is grown in consecutive years")) return "Aynı ürün art arda ekilmiyor; bu, zararlı ve hastalık döngülerini azaltmaya yardımcı olur.";

  const windows = line.match(/^Across (\d+) historical (\d+)-year windows \(agricultural years (.+)\), the median crop water demand was ([\d.]+) mm(?:, of which ([\d.]+) mm \(([^)]+)\) had to come from irrigation| and rain plus stored soil water left ([\d.]+) mm \(([^)]+)\) unmet under rain-fed management)\.$/);
  if (windows) {
    const common = `${windows[1]} geçmiş ${windows[2]} yıllık dönem (${windows[3]}) için ortanca ürün su ihtiyacı ${windows[4]} mm.`;
    return windows[5]
      ? `${common} Bunun ${windows[5]} mm'lik kısmı (${windows[6]}) sulamadan karşılanmalıydı.`
      : `${common} Yağış ve depolanmış toprak suyu sonrasında ${windows[7]} mm (${windows[8]}) açık kaldı.`;
  }
  const driest = line.match(/^In the driest tenth of simulated seasons at least ([^ ]+) of crop water demand (had to be irrigated|went unmet); the most extreme season was (.+) in (.+) \(([^)]+)\)\.$/);
  if (driest) return `En kurak onda birlik dilimde su ihtiyacının en az ${driest[1]}'i ${driest[2] === "went unmet" ? "karşılanamadı" : "sulamayla karşılandı"}; en uç dönem ${driest[4]} yılında ${nameFromEnglish(driest[3])} için görüldü (${driest[5]}).`;
  const nitrogen = line.match(/^Legumes \((.+)\) earn an estimated ([\d.]+) kg N\/ha of nitrogen credit for the crops that follow them/);
  if (nitrogen) return `Baklagiller (${nitrogen[1].split(", ").map(nameFromEnglish).join(", ")}) sonraki ürünler için tahmini ${nitrogen[2]} kg N/ha azot katkısı sağlar. Bu değer ABD denemelerine dayanır; yerel sonuçlar değişebilir.`;
  if (line.startsWith("The legume year")) return "Baklagil yılını plan süresinde baklagil olmayan bir ürün izlemiyor veya bu toprakta azot katkısı hesaplanmıyor.";
  const families = line.match(/^The rotation uses (\d+) botanical families, its rooting depths span ([\d.]+) m and a crop is in the field ([^ ]+) of the time\.$/);
  if (families) return `Bu ekim sırası ${families[1]} botanik aile içerir; kök derinlikleri ${families[2]} m aralığındadır ve alan zamanın ${families[3]} kadarında ekilidir.`;
  if (line.startsWith("The income index only reflects")) return "Gelir endeksi yalnızca ürün su ihtiyacının ne kadarının karşılandığını yansıtır. Fiyatları içermez; kâr tahmini olarak yorumlanmamalıdır.";
  return line;
}

export function methodText(method: string, locale: Locale) {
  if (locale !== "tr" || !method.startsWith("Pearson correlation, one value per year")) return method;
  return "Her yıl için modellenen su stresi ile tarla merkezindeki MODIS NDVI bitki örtüsü anomalisinin standartlaştırılmış değeri Pearson korelasyonu ile karşılaştırılır. Su stresi, yağışa dayalı kışlık buğdayın 1 Nisan ile hasat arasındaki gerçek ve potansiyel su tüketimi oranından (1 − ΣETa/ΣETc) hesaplanır. Günlük FAO-56 kök bölgesi su dengesi NASA POWER yağış ve Penman-Monteith ET₀ verisini, SoilGrids kullanılabilir su kapasitesiyle birleştirir. Aynı karşılaştırma Nisan–Eylül iklimsel kuraklık endeksi (1 − ΣP/ΣET₀) için de yapılır. %95 güven aralıkları yıllar üzerinden eşleştirilmiş bootstrap örneklemesiyle hesaplanır (10.000 tekrar, tohum 2026). Protokol docs/VALIDATION.md dosyasında önceden belirlenmiştir.";
}

export function caveatText(line: string, validation: Validation, locale: Locale, number: (value: number, digits?: number) => string) {
  if (locale !== "tr") return line;
  if (line.startsWith("Model (winter-wheat water balance)") && validation.baseline && validation.correlation_ci95 && validation.difference_ci95) {
    const interval = (values: number[]) => `${number(values[0], 2)} ile ${number(values[1], 2)}`;
    return `Kışlık buğday su dengesi modelinin korelasyonu r = ${number(validation.correlation, 2)} (%95 aralık ${interval(validation.correlation_ci95)}). Temel çizgi r = ${number(validation.baseline.correlation, 2)} (%95 aralık ${interval(validation.baseline.correlation_ci95)}). Farkın %95 aralığı ${interval(validation.difference_ci95)}; aralık sıfırı içeriyorsa belirgin üstünlük gösterilemez.`;
  }
  if (line.startsWith("The land use of the pixel")) return "Pikseldeki arazi kullanımı bilinmiyor. Model yağışa dayalı kışlık buğday varsayar; sulanan veya yazlık ürün, meyve bahçesi, mera ya da karma arazi farklı etkenlere göre yeşillenebilir.";
  if (line.startsWith("Irrigation is not represented")) return "Sulama modelde temsil edilmiyor. Sulanan tarlalar kurak yıllarda da yeşil kalabilir; bu, ilişkiyi zayıflatır.";
  if (line.startsWith("NDVI is a single 250 m pixel")) return "NDVI tek bir 250 m pikselden gelir; birden fazla tarla ve arazi kullanımını birlikte içerebilir.";
  const sample = line.match(/^(\d+) years is a small sample/);
  if (sample) return `${sample[1]} yıl küçük bir örneklemdir. Korelasyon belirsizdir; nedensellik değil ilişki gösterir.`;
  if (line.startsWith("Years left out for too few")) return line.replace("Years left out for too few cloud-free NDVI composites:", "Yeterli bulutsuz NDVI gözlemi olmadığı için dışarıda bırakılan yıllar:");
  return line;
}

export function baselineName(name: string, locale: Locale) {
  return locale === "tr" && name.startsWith("Dryness index") ? "İklimsel kuraklık endeksi (1 − P/ET₀)" : name;
}
