const TURKISH: Record<string, string> = { ı: "i", İ: "i", ş: "s", Ş: "s", ç: "c", Ç: "c", ğ: "g", Ğ: "g", ö: "o", Ö: "o", ü: "u", Ü: "u" };

/**
 * Folds text for keyword matching in either language: lowercase without locale rules (so "NDVI" stays "ndvi"),
 * Turkish letters to their ASCII base, other accents and punctuation removed, whitespace collapsed. Apply it to the
 * question and to every keyword.
 */
export function fold(text: string): string {
  return text
    .replace(/[ıİşŞçÇğĞöÖüÜ]/g, (c) => TURKISH[c])
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{M}+/gu, "")
    .replace(/[^\p{L}\p{N}₀-₉]+/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

const folded = new Map<string, string>();

/** A folded keyword; a leading or trailing space in the keyword still means a word boundary. */
export function foldKeyword(word: string): string {
  let hit = folded.get(word);
  if (hit === undefined) {
    hit = `${word.startsWith(" ") ? " " : ""}${fold(word)}${word.endsWith(" ") ? " " : ""}`;
    folded.set(word, hit);
  }
  return hit;
}

/** The folded question, padded so keywords with boundary spaces match at the start and end. */
export const foldQuestion = (question: string) => ` ${fold(question)} `;

export const hasAny = (foldedQuestion: string, words: readonly string[]) => words.some((w) => foldedQuestion.includes(foldKeyword(w)));
