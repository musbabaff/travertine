import type { Locale } from "@/i18n";

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

export function nameFromEnglish(name: string) {
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

/**
 * Engine sentences (explanations, method, caveats) are shown exactly as the engine returns them. Turkish text comes
 * from the engine's `language` parameter (contract #39), never from client-side paraphrases, so that no caveat is
 * softened or reworded. These helpers are kept as identity functions for the call sites.
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars -- kept for existing call sites
export function explanationText(line: string, ..._unused: unknown[]) {
  return line;
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars -- kept for existing call sites
export function methodText(method: string, ..._unused: unknown[]) {
  return method;
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars -- kept for existing call sites
export function caveatText(line: string, ..._unused: unknown[]) {
  return line;
}

/** The validation baseline is labelled in English by the contract; the one the engine uses has a Turkish name. */
export function baselineName(name: string, locale: Locale) {
  if (locale !== "tr") return name;
  return /^(Climatic dryness index|Dryness index)/i.test(name) ? "İklimsel kuraklık endeksi, Nisan–Eylül 1 − ΣP/ΣET0" : name;
}
