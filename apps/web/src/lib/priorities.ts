import type { Priorities } from "./api/types";

export type Horizon = 3 | 4 | 5;
export const HORIZONS: Horizon[] = [3, 4, 5];
export const OBJECTIVES = ["water", "income", "soil", "risk"] as const;
export type Objective = (typeof OBJECTIVES)[number];

export const DEFAULT_PRIORITIES: Priorities = { water: 0.5, income: 0.5, soil: 0.5, risk: 0.5 };
export const DEFAULT_HORIZON: Horizon = 4;

const clamp01 = (v: number) => Math.min(1, Math.max(0, v));
const round2 = (v: number) => Math.round(v * 100) / 100;

/** Reads `p=water,income,soil,risk` and `h=3|4|5`. Invalid values fall back to defaults. */
export function parseExplore(params: URLSearchParams): { priorities: Priorities; horizon: Horizon } {
  let priorities = DEFAULT_PRIORITIES;
  const raw = params.get("p")?.split(",").map(Number);
  if (raw && raw.length === 4 && raw.every((v) => Number.isFinite(v))) {
    const [water, income, soil, risk] = raw.map((v) => round2(clamp01(v)));
    priorities = { water, income, soil, risk };
  }
  const h = Number(params.get("h"));
  const horizon = (HORIZONS as number[]).includes(h) ? (h as Horizon) : DEFAULT_HORIZON;
  return { priorities, horizon };
}

export function writeExplore(params: URLSearchParams, priorities: Priorities, horizon: Horizon): URLSearchParams {
  const next = new URLSearchParams(params);
  next.set("p", OBJECTIVES.map((k) => round2(priorities[k]).toFixed(2)).join(","));
  next.set("h", String(horizon));
  // The current rotation never outlasts the horizon: the engine rejects a longer one.
  const cur = (next.get("cur") ?? "").split(",").filter(Boolean);
  if (cur.length > horizon) next.set("cur", cur.slice(0, horizon).join(","));
  return next;
}

/** Weighted mean of objective scores. Equal weights when every priority is zero. */
export function weightedTotal(scores: Record<Objective, number>, p: Priorities): number {
  const sum = p.water + p.income + p.soil + p.risk;
  const w = sum > 0 ? p : DEFAULT_PRIORITIES;
  const s = sum > 0 ? sum : 2;
  return round2(OBJECTIVES.reduce((a, k) => a + w[k] * scores[k], 0) / s);
}
