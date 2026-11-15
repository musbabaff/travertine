export const monitoringPages = [
  {
    href: "/monitoring",
    title: "Tarla İzleme",
    description: "Tarlaların durumunu incele",
  },
  {
    href: "/weather",
    title: "Hava Durumu",
    description: "Sıcaklık ve hava tahminleri",
  },
  {
    href: "/irrigation",
    title: "Sulama",
    description: "Sulama planı ve kontrolü",
  },
  {
    href: "/production",
    title: "Üretim",
    description: "Ürünler ve ekili alanlar",
  },
];
export const analyticsPages = [
  {
    href: "/analytics",
    title: "Analiz Özeti",
    description: "Çiftliğin genel performansı",
  },
  {
    href: "/yield",
    title: "Verim Analizi",
    description: "Haftalık verim karşılaştırması",
  },
  {
    href: "/harvest",
    title: "Hasat",
    description: "Hasat takvimi ve ilerleme",
  },
  {
    href: "/reports",
    title: "Raporlar",
    description: "Dönem ve tarla raporları",
  },
];
export const utilityPages = [
  {
    href: "/notifications",
    title: "Bildirimler",
    description: "Çiftlikten son gelişmeler",
  },
  {
    href: "/settings",
    title: "Ayarlar",
    description: "Görünüm ve bildirim tercihleri",
  },
  {
    href: "/profile",
    title: "Profil",
    description: "Çiftlik yöneticisi bilgileri",
  },
  {
    href: "/search",
    title: "Arama",
    description: "Tarlaları ve bölümleri bul",
  },
];
export const decisionPages = [
  {
    href: "/field-summary",
    title: "Tarla Sağlığı",
    description: "Toprak ve saha göstergeleri",
  },
  {
    href: "/explore",
    title: "Ekim Önerileri",
    description: "Önceliklere göre ürün seçenekleri",
  },
  {
    href: "/rotation-plan",
    title: "Ekim Planı",
    description: "Yıllara göre ürün sırası",
  },
  {
    href: "/evidence",
    title: "Veri ve Yöntem",
    description: "Kaynaklar ve model sınırları",
  },
];
export const allPages = [
  ...monitoringPages,
  ...analyticsPages,
  ...utilityPages,
  ...decisionPages,
];
