import { fields } from "../section-content";
import { demoField, rotationOptions } from "../field-shift";
import type { CosmoPose } from "./mascot";

export type CosmoLink = { href: string; label: string };
export type CosmoReply = { text: string; pose?: CosmoPose; links?: CosmoLink[] };

const tr = (value: number) => value.toLocaleString("tr-TR");
const pick = <T,>(options: T[]) => options[Math.floor(Math.random() * options.length)];

const totalArea = fields.reduce((sum, field) => sum + field.area, 0);
const driest = fields.reduce((low, field) => (field.moisture < low.moisture ? field : low));
const wettest = fields.reduce((high, field) => (field.moisture > high.moisture ? field : high));

// Keşif ekranının açılış ağırlıkları: su, gelir, toprak, risk.
const openingWeights = [60, 50, 70, 55];
const weightSum = openingWeights.reduce((a, b) => a + b, 0);
const ranked = rotationOptions
  .map((option) => ({
    ...option,
    score:
      (option.water * openingWeights[0] +
        option.income * openingWeights[1] +
        option.soil * openingWeights[2] +
        option.risk * openingWeights[3]) /
      weightSum,
  }))
  .sort((a, b) => b.score - a.score);

const describeField = (field: (typeof fields)[number]) =>
  `${field.name}: ${field.area} hektar, ${field.trees} ağaç. Toprak nemi %${field.moisture}, hasat ilerlemesi %${tr(field.progress)}.`;

const pageGuide: Record<string, string> = {
  "/": "Genel Bakış çiftliğin özet ekranı. Bugünün sıcaklığı, 40 hektarlık ürün dağılımı ve sulama hızı solda; sağdaki tarla görselinde seçili tarlanın nemi, ağaç sayısı ve hasat ilerlemesi var.",
  "/monitoring": "Tarla İzleme'de üç tarlayı listeden seçersin; alanı, toprak nemi ve hasat ilerlemesi yandaki görselin üstünde açılır.",
  "/weather": "Hava Durumu bugünün sıcaklığını, en düşük ve en yüksek değeri ve 09.00–14.00 arası saatlik görünümü verir.",
  "/irrigation": "Sulama'da tarla seçip hızı ayarlarsın. Bu sürümde seçim cihaza gönderilmez, yalnızca ekranda kalır.",
  "/production": "Üretim, ürün bazında ekili alanı ve ağaç sayılarını gösterir.",
  "/analytics": "Analiz Özeti haftalık verim grafiğini, toprak nemini ve hasat halkasını bir araya getirir. Ürün ve hafta seçince grafik ona göre değişir.",
  "/yield": "Verim Analizi yedi haftalık verim serisini ürüne göre karşılaştırır. Değerler örnek seridir, tahmin değildir.",
  "/harvest": "Hasat, her ürünün hasat ilerlemesini ve alanını sıralar.",
  "/reports": "Raporlar'da kayıtları ürüne göre süzer, görünen satırları CSV olarak indirirsin.",
  "/notifications": "Bildirimler çiftlikteki son değişiklikleri listeler; okunmamış olanı buradan okundu yapabilirsin.",
  "/settings": "Ayarlar'da tarla sınırlarını ve bildirimleri açıp kapatırsın. Tercihler bu oturumda geçerlidir.",
  "/profile": "Profil, çiftlik yöneticisinin bilgilerini ve çiftlik özetini gösterir.",
  "/search": "Arama, sayfaları ve bölümleri adına göre bulur.",
  "/field-summary": `Tarla Sağlığı, ${demoField.name} örnek tarlasının koşullarını gösterir: ${tr(demoField.areaHectares)} hektar, killi tın toprak, pH ${tr(demoField.ph)}, ${demoField.availableWaterMm} mm kullanılabilir su.`,
  "/explore": "Ekim Önerileri'nde su, gelir, toprak ve risk önceliklerini ayarlarsın; ürün seçenekleri bu ağırlıklara göre yeniden sıralanır.",
  "/rotation-plan": "Ekim Planı seçilen ürün sırasını yıl yıl gösterir ve yazdırılabilir. Su değerleri bilim motoru bağlanınca dolacak.",
  "/evidence": "Veri ve Yöntem ekranı kullanılan kaynakları ve yöntemin geçmiş verilerle karşılaştırılmasını açıklar.",
};
pageGuide["/dashboard"] = pageGuide["/"];

const starters: Record<string, string[]> = {
  "/irrigation": ["Hangi tarlanın nemi en düşük?", "Sulama komutu gerçek mi?"],
  "/weather": ["Bugün hava nasıl?", "Hangi tarlanın nemi en düşük?"],
  "/explore": ["Ekim önerileri nasıl sıralanıyor?", "Örnek veri ne demek?"],
  "/rotation-plan": ["Ekim planı nasıl hazırlanıyor?", "Veriler nereden geliyor?"],
  "/evidence": ["Hangi veriler kullanılıyor?", "Yöntemin sınırları neler?"],
  "/field-summary": ["Bu tarla verileri nereden geliyor?", "Toprak ve su göstergeleri ne anlatıyor?"],
  "/reports": ["Raporu nasıl indiririm?", "Tarlaların durumu nasıl?"],
};

export function startersFor(pathname: string) {
  return ["Bu sayfada ne var?", ...(starters[pathname] ?? ["Tarlaların durumu nasıl?", "Rotasyon önerin ne?"])];
}

export const greeting =
  "Merhaba, ben Cosmo. Travertine'de ekranları anlatır, tarlaların durumunu özetlerim. Ne merak ediyorsun?";

type Topic = { words: string[]; answer: (question: string, pathname: string) => CosmoReply };

const topics: Topic[] = [
  {
    words: ["bu sayfa", "burada ne", "bu ekran", "ne işe yar", "neredeyim"],
    answer: (_, pathname) => ({
      text: pageGuide[pathname] ?? "Bu ekranı henüz tanımıyorum. Üst menüden bir bölüm açarsan orayı anlatırım.",
    }),
  },
  {
    words: ["komut", "cihaz", "vana"],
    answer: () => ({
      text: "Hayır. Sulama ekranındaki hız seçimi bu sürümde cihaza gitmiyor; “Seçimi uygula” yalnızca ekrandaki durumu günceller.",
      links: [{ href: "/irrigation", label: "Sulama" }],
    }),
  },
  {
    words: ["gerçek mi", "yapay zeka", "yapay zekâ", "robot musun", "demo", "örnek veri", "canlı mı"],
    answer: () => ({
      text: "Şu an hazır yanıtlarla çalışıyorum; arkamda bir dil modeli yok. Söylediğim sayılar da arayüzdeki örnek verilerden geliyor, gerçek ölçüm değil.",
      pose: "think",
    }),
  },
  {
    words: ["nem", "kuru", "sulama", "sula", "susuz"],
    answer: () => ({
      text: `En düşük toprak nemi %${driest.moisture} ile ${driest.name}; en yüksek %${wettest.moisture} ile ${wettest.name}. Hızı Sulama sayfasından tarla tarla ayarlayabilirsin.`,
      links: [{ href: "/irrigation", label: "Sulama" }, { href: "/monitoring", label: "Tarla İzleme" }],
    }),
  },
  {
    words: ["elma", "üzüm", "bağ", "kiraz"],
    answer: (question) => {
      const field =
        fields.find((entry) => question.includes(entry.crop.toLocaleLowerCase("tr"))) ??
        fields.find((entry) => entry.crop === "Üzüm")!;
      return { text: describeField(field), links: [{ href: "/monitoring", label: "Tarla İzleme" }] };
    },
  },
  {
    words: ["rotasyon", "ekim nöbeti", "münavebe", "ne ekeyim", "ne ekmeli", "hangi ürün"],
    answer: () => ({
      text: `Açılış önceliklerinde ilk sırada ${ranked[0].tr} var (puan ${tr(Number(ranked[0].score.toFixed(2)))}), ardından ${ranked[1].tr}. Su, gelir, toprak ve risk ağırlıklarını değiştirince sıralama da değişir; kendi önceliklerinle dene.`,
      links: [{ href: "/explore", label: "Ekim Önerileri" }, { href: "/rotation-plan", label: "Ekim Planı" }],
    }),
  },
  {
    words: ["kanıt", "güven", "doğru mu", "model", "geri test", "sınama"],
    answer: () => ({
      text: "Örnek tarlanın 24 yıllık geri testinde hesaplanan su stresi ile gözlenen bitki örtüsü arasında r = −0,48 ilişki görülüyor. Bu sonuç kusursuz bir model kanıtı ya da gelecek tahmini değil.",
      pose: "think",
      links: [{ href: "/evidence", label: "Veri ve Yöntem" }],
    }),
  },
  {
    words: ["hasat", "verim"],
    answer: () => ({
      text: `Hasat ilerlemesi: ${fields.map((field) => `${field.crop} %${tr(field.progress)}`).join(", ")}. Haftalık verim serisi Analizler altında.`,
      links: [{ href: "/harvest", label: "Hasat" }, { href: "/yield", label: "Verim Analizi" }],
    }),
  },
  {
    words: ["veri", "kaynak", "uydu", "nasa", "modis", "landsat", "sentinel", "soilgrids"],
    answer: () => ({
      text: "Ekim Kararı ekranları NASA POWER iklim kayıtlarına, MODIS ve Landsat / Sentinel-2 bitki örtüsü verisine ve SoilGrids toprak haritasına dayanıyor. Küresel toprak ızgarası 250 m çözünürlükte; tarlanın içindeki farkları göstermez.",
      links: [{ href: "/field-summary", label: "Tarla Sağlığı" }],
    }),
  },
  {
    words: ["hava", "sıcaklık", "derece", "yağmur"],
    answer: () => ({
      text: "Panodaki örnek değere göre bugün 30°C; gün içinde 24–38°C aralığı görünüyor. Yağış tahmini bu arayüzde yok.",
      links: [{ href: "/weather", label: "Hava Durumu" }],
    }),
  },
  {
    words: ["rapor", "csv", "indir", "excel"],
    answer: () => ({
      text: "Raporlar sayfasında ürünü seçip “CSV indir”e bas. Dosya görünen satırlardan tarayıcıda üretilir ve Excel'de Türkçe karakterlerle açılır.",
      links: [{ href: "/reports", label: "Raporlar" }],
    }),
  },
  {
    words: ["tarla", "çiftlik", "durum", "özet", "alan", "hektar"],
    answer: () => ({
      text: `Çiftlikte ${fields.length} tarla, toplam ${totalArea} hektar var.\n${fields.map(describeField).join("\n")}`,
      links: [{ href: "/monitoring", label: "Tarla İzleme" }],
    }),
  },
  {
    words: ["kimsin", "adın", "nesin", "cosmo", "maskot"],
    answer: () => ({
      text: "Ben Cosmo, Travertine'in ekran içi rehberiyim. Tarlaların durumunu özetler, verilerin ne anlattığını açıklar ve ilgili bölüme yönlendiririm.",
      pose: "wave",
    }),
  },
  {
    words: ["neler yap", "ne yap", "yardım", "nasıl kullan"],
    answer: () => ({
      text: "Bulunduğun ekranı anlatırım, tarlaların alanını, nemini ve hasat durumunu söylerim, rotasyon ve kanıt ekranlarına götürürüm. “Zıpla” ya da “uyu” dersen onu da yaparım.",
    }),
  },
  { words: ["zıpla", "hopla"], answer: () => ({ text: "Hop!", pose: "jump" }) },
  { words: ["dans", "sevin", "kutla"], answer: () => ({ text: "Antenlerim ritmi tuttu.", pose: "cheer" }) },
  { words: ["uyan", "kalk"], answer: () => ({ text: "Buradayım, uyandım.", pose: "wave" }) },
  {
    words: ["uyu", "uyku", "dinlen"],
    answer: () => ({ text: "Biraz kestiriyorum. “Uyan” yazarsan kalkarım.", pose: "sleep" }),
  },
  {
    words: ["teşekkür", "sağ ol", "sağol", "eyvallah", "eline sağlık"],
    answer: () => ({ text: pick(["Rica ederim.", "Ne demek, her zaman."]), pose: "cheer" }),
  },
  {
    words: ["görüşürüz", "hoşça kal", "hoşçakal", "güle güle"],
    answer: () => ({ text: "Görüşürüz. Köşedeyim, istediğinde yaz.", pose: "wave" }),
  },
  {
    words: ["merhaba", "selam", "günaydın", "iyi akşamlar", "iyi günler", "hey"],
    answer: () => ({ text: pick(["Selam! Ne bakıyoruz bugün?", "Merhaba. Hangi tarladan başlayalım?"]), pose: "wave" }),
  },
];

const unknown = [
  "Bunu bilmiyorum. Tarlaları, sulamayı, rotasyonu ya da bulunduğun ekranı sorabilirsin.",
  "Buna hazır bir yanıtım yok. “Bu sayfada ne var?” ya da “Rotasyon önerin ne?” diye deneyebilirsin.",
];

export function askCosmo(question: string, pathname: string): CosmoReply {
  const text = question.toLocaleLowerCase("tr");
  const topic = topics.find((entry) => entry.words.some((word) => text.includes(word)));
  return topic ? topic.answer(text, pathname) : { text: pick(unknown), pose: "think" };
}
