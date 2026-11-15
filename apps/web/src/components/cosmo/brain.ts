import type { MessageKey } from "@/i18n";
import type { CosmoPose } from "./mascot";

/**
 * Cosmo answers only from fixed, reviewed text in the locale files (keys `cosmo.*`). There is no language model and
 * no generated text. Keyword matching accepts English and Turkish questions.
 */
export type CosmoLink = { href: string; label: MessageKey };
export type CosmoReply = { text: MessageKey; pose?: CosmoPose; links?: CosmoLink[] };

const field: CosmoLink = { href: "/app", label: "nav.field" };
const overview: CosmoLink = { href: "/app/overview", label: "nav.overview" };
const explore: CosmoLink = { href: "/app/explore", label: "nav.explore" };
const evidence: CosmoLink = { href: "/app/evidence", label: "nav.evidence" };
const data: CosmoLink = { href: "/app/data", label: "nav.data" };

const pageGuide: Record<string, CosmoReply> = {
  "/": { text: "cosmo.page.home", links: [field] },
  "/app/overview": { text: "cosmo.page.overview", links: [field] },
  "/app": { text: "cosmo.page.field", links: [explore] },
  "/app/explore": { text: "cosmo.page.explore", links: [evidence] },
  "/app/evidence": { text: "cosmo.page.evidence", links: [data] },
  "/app/data": { text: "cosmo.page.data", links: [evidence] },
};

/** Glossary terms the challenge asks for. Order matters: more specific terms first. */
const GLOSSARY: { words: string[]; text: MessageKey; links?: CosmoLink[] }[] = [
  { words: ["soil moisture anomaly", "soil-moisture anomaly", "nem anomal", "toprak nemi anomal"], text: "cosmo.gloss.smAnomaly", links: [overview] },
  { words: ["evapotranspiration", "et0", "et₀", "evapotranspirasyon", "buharlaşma"], text: "cosmo.gloss.et", links: [overview] },
  { words: ["ndvi", "greenness", "yeşillik", "bitki örtüsü"], text: "cosmo.gloss.ndvi", links: [evidence] },
  { words: ["frost", "don "], text: "cosmo.gloss.frost" },
  { words: ["water balance", "su dengesi", "su bütçesi"], text: "cosmo.gloss.waterBalance", links: [explore] },
  { words: ["satellite", "ground", "station", "uydu", "yer ölçüm", "istasyon"], text: "cosmo.gloss.satellite", links: [data] },
];

const has = (text: string, words: string[]) => words.some((w) => text.includes(w));

export const GREETING: MessageKey = "cosmo.greeting";

export function startersFor(pathname: string): MessageKey[] {
  const common: MessageKey[] = ["cosmo.q.page", "cosmo.q.data", "cosmo.q.et"];
  if (pathname === "/app") return [...common, "cosmo.q.field"];
  if (pathname === "/app/explore") return [...common, "cosmo.q.ranking"];
  if (pathname === "/app/evidence") return [...common, "cosmo.q.trust"];
  return [...common, "cosmo.q.ndvi"];
}

export function askCosmo(question: string, pathname: string): CosmoReply {
  const q = ` ${question.toLocaleLowerCase("tr-TR").toLocaleLowerCase("en-GB")} `;

  if (has(q, ["jump", "zıpla", "hopla"])) return { text: "cosmo.r.jump", pose: "jump" };
  if (has(q, ["dance", "celebrate", "dans", "kutla", "sevin"])) return { text: "cosmo.r.cheer", pose: "cheer" };
  if (has(q, ["wake", "uyan"])) return { text: "cosmo.r.wake", pose: "wave" };
  if (has(q, ["sleep", "uyu"])) return { text: "cosmo.r.sleep", pose: "sleep" };

  for (const g of GLOSSARY) if (has(q, g.words)) return { text: g.text, links: g.links, pose: "think" };

  if (has(q, ["this page", "this screen", "where am i", "what is here", "bu sayfa", "bu ekran", "burada ne", "ne işe yar", "neredeyim"])) {
    return pageGuide[pathname] ?? pageGuide["/"];
  }
  if (has(q, ["rotation", "rank", "crop", "ekim", "rotasyon", "münavebe", "nöbet", "hangi ürün"])) return { text: "cosmo.r.ranking", links: [explore, evidence] };
  if (has(q, ["data", "source", "nasa", "soilgrids", "modis", "veri", "kaynak"])) return { text: "cosmo.r.data", links: [data] };
  if (has(q, ["trust", "reliable", "evidence", "accurate", "limit", "uncertain", "model", "güven", "kanıt", "doğru", "sınır", "belirsiz"])) {
    return { text: "cosmo.r.trust", links: [evidence], pose: "think" };
  }
  if (has(q, ["field", "location", "map", "area", "tarla", "konum", "harita", "alan"])) return { text: "cosmo.r.field", links: [field] };
  if (has(q, ["real", "demo", "live", "ai", "artificial", "gerçek", "örnek", "canlı", "yapay zek"])) return { text: "cosmo.r.whoami", pose: "think" };
  if (has(q, ["voice", "microphone", "speak", "ses", "mikrofon", "konuş"])) return { text: "cosmo.r.voice" };
  if (has(q, ["hello", " hi ", "hey", "merhaba", "selam", "günaydın"])) return { text: "cosmo.r.hello", pose: "wave" };
  if (has(q, ["thank", "teşekkür", "sağ ol", "eyvallah"])) return { text: "cosmo.r.thanks", pose: "cheer" };
  return { text: "cosmo.r.unknown", pose: "think" };
}
