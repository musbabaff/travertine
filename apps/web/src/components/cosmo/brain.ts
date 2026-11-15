import type { CosmoPose } from "./mascot";

export type CosmoLink = { href: string; label: string };
export type CosmoReply = { text: string; pose?: CosmoPose; links?: CosmoLink[] };

const field = { href: "/app", label: "Tarla İzleme" };
const explore = { href: "/app/explore", label: "Ekim Önerileri" };
const evidence = { href: "/app/evidence", label: "Veri ve Yöntem" };

const pageGuide: Record<string, CosmoReply> = {
  "/": {
    text: "Genel Bakış, seçili konumun yıllık iklim ortalamasını, toprak özelliklerini, NDVI geçmişini ve su dengesini gösterir. Tarla seçmediyseniz Denizli örnek konumu görünür.",
    links: [field],
  },
  "/app": {
    text: "Burada yer arayabilir, haritada nokta koyabilir veya tarla sınırı çizebilirsiniz. Seçiminiz bağlantıya yazılır; aşağıdaki analiz iklim, toprak ve bitki örtüsü kaynaklarını gösterir.",
    links: [explore],
  },
  "/app/explore": {
    text: "Su, gelir, toprak sağlığı ve risk önceliklerini değiştirince ekim seçenekleri yeniden sıralanır. Kartları açıp yıllık su gereksinimini görebilir, iki seçeneği karşılaştırabilirsiniz.",
    links: [evidence],
  },
  "/app/evidence": {
    text: "Bu sayfa modelin geçmiş yıllardaki bitki örtüsü gözlemleriyle ilişkisini, temel çizgi karşılaştırmasını, kullanılan kaynakları ve sınırlamaları gösterir.",
    links: [explore],
  },
};

export const greeting = "Merhaba, ben Cosmo. Travertine ekranlarında sana yol gösterebilirim. Hangi bölümü merak ediyorsun?";

export function startersFor(pathname: string) {
  const common = ["Bu sayfada ne var?", "Veriler nereden geliyor?"];
  if (pathname === "/app") return [...common, "Tarlayı nasıl seçerim?"];
  if (pathname === "/app/explore") return [...common, "Ekim önerileri nasıl sıralanıyor?"];
  if (pathname === "/app/evidence") return [...common, "Bu sonuç ne kadar güvenilir?"];
  return [...common, "Ekim önerilerine nasıl bakarım?"];
}

export function askCosmo(question: string, pathname: string): CosmoReply {
  const text = question.toLocaleLowerCase("tr-TR");

  if (["zıpla", "hopla"].some((word) => text.includes(word))) return { text: "Hop!", pose: "jump" };
  if (["dans", "kutla", "sevin"].some((word) => text.includes(word))) return { text: "Bunu kutlayalım!", pose: "cheer" };
  if (text.includes("uyu")) return { text: "Biraz dinleniyorum. Uyan dediğinde buradayım.", pose: "sleep" };
  if (text.includes("uyan")) return { text: "Buradayım, devam edebiliriz.", pose: "wave" };

  if (["bu sayfa", "bu ekran", "burada ne", "ne işe yar", "neredeyim"].some((word) => text.includes(word))) {
    return pageGuide[pathname] ?? pageGuide["/"];
  }
  if (["ekim", "rotasyon", "münavebe", "hangi ürün"].some((word) => text.includes(word))) {
    return {
      text: "Ekim sıralaması su, gelir, toprak sağlığı ve risk puanlarını seçtiğiniz ağırlıklarla birleştirir. Sonuçlar tahmin edilen hasat miktarı değildir; seçenekleri karşılaştırmak içindir.",
      links: [explore, evidence],
    };
  }
  if (["veri", "kaynak", "nasa", "uydu", "soilgrids", "modis"].some((word) => text.includes(word))) {
    return {
      text: "İklim, toprak ve bitki örtüsü değerlerinin kaynağı ilgili kartlarda gösterilir. Üstteki etiket canlı motoru, örnek veriyi veya bağlantı kesilince kullanılan yedek veriyi belirtir.",
      links: [evidence],
    };
  }
  if (["güven", "kanıt", "doğru", "sınır", "belirsiz", "model"].some((word) => text.includes(word))) {
    return {
      text: "Geçmiş verilerle karşılaştırma bir ilişki gösterir; tek başına neden-sonuç veya gelecek verim garantisi değildir. Korelasyonu, belirsizlik aralığını ve varsayımları Veri ve Yöntem ekranında okuyabilirsiniz.",
      links: [evidence],
      pose: "think",
    };
  }
  if (["tarla", "konum", "harita", "alan", "toprak", "nem"].some((word) => text.includes(word))) {
    return {
      text: "Tarla İzleme'de bir konum arayın, nokta koyun veya sınır çizin. Cosmo şu an ekrandaki sayısal yanıtları doğrudan okumuyor; güncel değerleri tarla özeti gösteriyor.",
      links: [field],
    };
  }
  if (["gerçek", "demo", "örnek", "canlı", "yapay zekâ", "yapay zeka"].some((word) => text.includes(word))) {
    return {
      text: "Ben şimdilik hazır açıklamalarla çalışan bir arayüz rehberiyim. Bir dil modeli bağlantım yok. Veri kaynağını üstteki etiketten kontrol edebilirsiniz.",
      pose: "think",
    };
  }
  if (["ses", "mikrofon", "konuş"].some((word) => text.includes(word))) {
    return { text: "Tarayıcınız destekliyorsa mikrofon düğmesiyle soru sorabilirsiniz. Sesli yanıtı sohbet başlığından açıp kapatabilirsiniz." };
  }
  if (["merhaba", "selam", "günaydın", "hey"].some((word) => text.includes(word))) {
    return { text: "Merhaba! İstersen bulunduğun sayfayı birlikte inceleyelim.", pose: "wave" };
  }
  if (["teşekkür", "sağ ol", "eyvallah"].some((word) => text.includes(word))) {
    return { text: "Rica ederim.", pose: "cheer" };
  }

  return {
    text: "Bunun için hazır bir açıklamam yok. Bulunduğun ekranı, tarla seçimini veya ekim önerilerini sorabilirsin.",
    pose: "think",
  };
}
