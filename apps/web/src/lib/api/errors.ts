import type { MessageKey } from "@/i18n";
import { ApiRequestError } from "./client";

/**
 * Engine validation messages are English. The UI shows a localized sentence for the ones it knows; anything else
 * becomes a generic localized message, with the raw detail logged for debugging only.
 */
const MESSAGES: [RegExp, MessageKey][] = [
  [/^current_rotation is longer than horizon_years/, "error.currentTooLong"],
  [/^Unknown crop ids in current_rotation/, "error.currentUnknownCrop"],
  [/^crop_values has no value for a crop in current_rotation/, "error.currentNoValue"],
  [/^crop_values needs one value for every candidate crop/, "farmer.err.allCrops"],
  [/^At least one crop value must be above 0/, "error.valuesZero"],
  [/^Give sand_pct and clay_pct together/, "farmer.err.sandClay"],
  [/^sand_pct \+ clay_pct cannot exceed 100/, "error.sandClaySum"],
  [/^crop_ids must include at least one legume/, "error.needLegume"],
  [/^Unknown crop_ids/, "error.unknownCrop"],
  [/^No rotation satisfies the agronomic rules/, "error.noRotation"],
  [/^The climate record is too short/, "error.recordShort"],
  [/^The climate record has no complete year/, "error.recordShort"],
  [/^NASA POWER has no data at this location/, "error.noPower"],
  [/^Too few years with both a modelled value and a usable NDVI season/, "error.fewNdviYears"],
  [/^Demo data only covers/, "error.demoHorizon"],
];

const CODES: Record<string, MessageKey> = {
  rate_limited: "error.rateLimited",
  upstream_unavailable: "error.upstream",
  out_of_coverage: "error.outOfCoverage",
};

export function errorKey(err: unknown): MessageKey {
  const message = err instanceof Error ? err.message : String(err ?? "");
  for (const [pattern, key] of MESSAGES) if (pattern.test(message)) return key;
  const code = err instanceof ApiRequestError ? err.code : undefined;
  if (code && CODES[code]) return CODES[code];
  if (err instanceof ApiRequestError && err.status === 429) return "error.rateLimited";
  if (typeof console !== "undefined") console.error("Unmapped engine error:", message, err);
  return "error.generic";
}

/** The localized sentence for an error, ready for an error card. */
export function errorText(err: unknown, t: (key: MessageKey) => string): string {
  return t(errorKey(err));
}
