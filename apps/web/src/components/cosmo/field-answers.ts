import type { MessageKey, Vars } from "@/i18n";
import type { FieldHazards, Provenance, RotationExploreResponse, Validation } from "@/lib/api/types";
import { foldKeyword, foldQuestion, hasAny } from "@/lib/fold";
import type { CosmoLink } from "./brain";

/**
 * Answers about the selected field, built only from engine responses already loaded for it. Each answer is a fixed
 * template from the locale files plus, where useful, the engine's own sentences (already in the UI language).
 * When the response an answer needs is not loaded, Cosmo says so and points to the page that loads it.
 */
export interface FieldContext {
  rotations?: RotationExploreResponse;
  validation?: Validation;
  hazards?: FieldHazards;
  provenance?: Provenance[];
  cropName: (id: string) => string;
  n: (value: number, digits?: number) => string;
}

export interface FieldReply {
  text: MessageKey;
  vars?: Vars;
  lines?: string[];
  links?: CosmoLink[];
}

const explore: CosmoLink = { href: "/app/explore", label: "nav.explore" };
const evidence: CosmoLink = { href: "/app/evidence", label: "nav.evidence" };
const data: CosmoLink = { href: "/app/data", label: "nav.data" };
const field: CosmoLink = { href: "/app", label: "nav.field" };

const has = hasAny;

export const INTENTS = {
  top: ["first", "top", "best", "rank first", "why this", "which rotation", "ilk sıra", "birinci", "en üst", "neden bu", "hangi rotasyon", "hangi ekim"],
  current: ["current", "my rotation", "compare", "mevcut", "şu anki", "şimdiki", "karşılaştır", "benim rotasyon"],
  deficit: ["deficit", "water short", "unmet", "su açığı", "su eksi", "karşılanamay", "açık ne"],
  hazards: ["hazard", "frost date", "frost-free", "hot day", "heat", "dry spell", "extreme rain", "tehlike", "don tarihi", "donsuz", "sıcak gün", "kurak dönem", "aşırı yağış", "sağanak"],
  sources: ["where does", "where do", "come from", "source of", "nereden", "kaynağı", "hangi veri"],
} as const;

// Fold every keyword once, when the module loads.
Object.values(INTENTS).forEach((words) => words.forEach(foldKeyword));

function seq(ids: string[], ctx: FieldContext) {
  return ids.map(ctx.cropName).join(" → ");
}

export function askField(question: string, ctx: FieldContext): FieldReply | null {
  const q = foldQuestion(question);
  const top = ctx.rotations?.rotations[0];

  if (has(q, [...INTENTS.current])) {
    const base = ctx.rotations?.baseline;
    if (!ctx.rotations) return { text: "cosmo.f.needExplore", links: [explore] };
    if (!base || !top) return { text: "cosmo.f.noCurrent", links: [explore] };
    const diff = top.vs_baseline?.total;
    return {
      text: "cosmo.f.current",
      vars: { current: seq(base.sequence, ctx), currentTotal: ctx.n(base.scores.total, 2), top: seq(top.sequence, ctx), topTotal: ctx.n(top.scores.total, 2), diff: diff === undefined ? "—" : ctx.n(diff, 2) },
      links: [explore],
    };
  }
  if (has(q, [...INTENTS.deficit])) {
    if (!top) return { text: "cosmo.f.needExplore", links: [explore] };
    const deficit = top.yearly.reduce((s, y) => s + y.water_deficit_mm, 0);
    const demand = top.yearly.reduce((s, y) => s + y.water_demand_mm, 0);
    return {
      text: "cosmo.f.deficit",
      vars: { seq: seq(top.sequence, ctx), deficit: ctx.n(deficit), demand: ctx.n(demand), years: top.yearly.length },
      lines: top.explanation.slice(0, 2),
      links: [explore],
    };
  }
  if (has(q, [...INTENTS.top])) {
    if (!top) return { text: "cosmo.f.needExplore", links: [explore] };
    const why = top.reasoning?.why_suggested ?? [];
    return {
      text: "cosmo.f.top",
      vars: { seq: seq(top.sequence, ctx), total: ctx.n(top.scores.total, 2) },
      lines: why.length ? why : top.explanation.slice(0, 2),
      links: [explore, evidence],
    };
  }
  if (has(q, [...INTENTS.hazards])) {
    const m = ctx.hazards?.median;
    if (!m) return { text: "cosmo.f.needField", links: [field] };
    return {
      text: "cosmo.f.hazards",
      vars: {
        frost: ctx.n(m.frost_days ?? 0),
        hot: ctx.n(m.summer_days ?? 0),
        heavy: ctx.n(m.r20mm_days ?? 0),
        dry: ctx.n(m.cdd_days ?? 0),
        years: ctx.hazards!.years.length,
      },
      lines: ctx.hazards!.caveats.slice(0, 1),
      links: [field],
    };
  }
  if (has(q, [...INTENTS.sources])) {
    const names = [...new Set((ctx.provenance ?? []).map((p) => p.dataset))];
    if (!names.length) return { text: "cosmo.f.needField", links: [field, data] };
    return { text: "cosmo.f.sources", lines: names, links: [data] };
  }
  return null;
}

/** Quick replies that fit the page; the data questions only once a field is selected. */
export function fieldStarters(pathname: string, hasField: boolean): MessageKey[] {
  if (!hasField) return [];
  if (pathname === "/app/explore") return ["cosmo.q.top", "cosmo.q.current", "cosmo.q.deficit"];
  if (pathname === "/app/evidence") return ["cosmo.q.sources"];
  if (pathname === "/app" || pathname === "/app/overview") return ["cosmo.q.hazards", "cosmo.q.sources"];
  return ["cosmo.q.sources"];
}
