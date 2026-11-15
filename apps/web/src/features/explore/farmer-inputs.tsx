"use client";

import { useId, useState } from "react";
import { useI18n, type MessageKey } from "@/i18n";
import type { Crop, FarmerInputs, InputSource } from "@/lib/api/types";
import { cropName } from "./crop-timeline";

type SoilKey = "sand_pct" | "clay_pct" | "organic_carbon_pct" | "available_water_mm_per_m";
const SOIL: { key: SoilKey; min: number; max: number; step: number; unit: string }[] = [
  { key: "sand_pct", min: 0, max: 100, step: 1, unit: "%" },
  { key: "clay_pct", min: 0, max: 100, step: 1, unit: "%" },
  { key: "organic_carbon_pct", min: 0, max: 20, step: 0.1, unit: "%" },
  { key: "available_water_mm_per_m", min: 20, max: 400, step: 1, unit: "mm/m" },
];

const num = (s: string) => (s.trim() === "" ? undefined : Number(s.replace(",", ".")));

/**
 * The farmer's own soil test and crop values. Sent as `farmer_inputs`; the engine checks them (422 explains what is
 * wrong) and lists in `inputs[]` which values replaced which estimate.
 */
export function FarmerInputsForm({
  crops,
  candidateIds,
  value,
  onApply,
}: {
  crops: Map<string, Crop> | undefined;
  candidateIds: string[];
  value: FarmerInputs | null;
  onApply: (v: FarmerInputs | null) => void;
}) {
  const { t, locale } = useI18n();
  const id = useId();
  const [soil, setSoil] = useState<Record<SoilKey, string>>(() => ({
    sand_pct: value?.soil?.sand_pct?.toString() ?? "",
    clay_pct: value?.soil?.clay_pct?.toString() ?? "",
    organic_carbon_pct: value?.soil?.organic_carbon_pct?.toString() ?? "",
    available_water_mm_per_m: value?.soil?.available_water_mm_per_m?.toString() ?? "",
  }));
  const [values, setValues] = useState<Record<string, string>>(() => Object.fromEntries(Object.entries(value?.crop_values ?? {}).map(([k, v]) => [k, String(v)])));
  const [error, setError] = useState("");

  function apply() {
    const s = Object.fromEntries(SOIL.map(({ key }) => [key, num(soil[key])]).filter(([, v]) => v !== undefined)) as FarmerInputs["soil"];
    if ((s?.sand_pct === undefined) !== (s?.clay_pct === undefined)) return setError(t("farmer.err.sandClay"));
    const filled = candidateIds.filter((c) => (values[c] ?? "").trim() !== "");
    if (filled.length > 0 && filled.length < candidateIds.length) return setError(t("farmer.err.allCrops"));
    const cropValues = filled.length ? Object.fromEntries(candidateIds.map((c) => [c, num(values[c]) ?? 0])) : undefined;
    const soilSet = s && Object.keys(s).length ? s : undefined;
    setError("");
    onApply(soilSet || cropValues ? { ...(soilSet ? { soil: soilSet } : {}), ...(cropValues ? { crop_values: cropValues } : {}) } : null);
  }

  return (
    <details className="rounded-md border border-border bg-surface shadow-1" data-testid="farmer-inputs" open={!!value || undefined}>
      <summary className="cursor-pointer px-4 py-3 text-h3 font-semibold md:px-5">{t("farmer.title")}</summary>
      <div
        role="group"
        aria-label={t("farmer.title")}
        className="space-y-4 border-t border-border px-4 py-4 md:px-5"
        onKeyDown={(e) => {
          if (e.key === "Enter" && (e.target as HTMLElement).tagName === "INPUT") {
            e.preventDefault();
            apply();
          }
        }}
      >
        <p className="text-xs text-ink-muted">{t("farmer.hint")}</p>
        <fieldset>
          <legend className="text-sm font-semibold text-ink">{t("farmer.soil")}</legend>
          <div className="mt-2 grid grid-cols-2 gap-3">
            {SOIL.map((f) => (
              <label key={f.key} className="block text-xs text-ink-2" htmlFor={`${id}-${f.key}`}>
                {t(`farmer.${f.key}` as MessageKey)} ({f.unit})
                <input
                  id={`${id}-${f.key}`}
                  inputMode="decimal"
                  className="mt-1 h-11 w-full rounded-sm border border-border-strong bg-surface px-2 text-sm tabular-nums text-ink md:h-9"
                  value={soil[f.key]}
                  onChange={(e) => setSoil((p) => ({ ...p, [f.key]: e.target.value }))}
                  aria-describedby={`${id}-range-${f.key}`}
                />
                <span id={`${id}-range-${f.key}`} className="text-xs text-ink-muted">
                  {f.min}–{f.max}
                </span>
              </label>
            ))}
          </div>
        </fieldset>
        <fieldset>
          <legend className="text-sm font-semibold text-ink">{t("farmer.values")}</legend>
          <p className="text-xs text-ink-muted">{t("farmer.values.hint")}</p>
          <div className="mt-2 grid grid-cols-2 gap-3">
            {candidateIds.map((c) => (
              <label key={c} className="block text-xs text-ink-2" htmlFor={`${id}-v-${c}`}>
                {cropName(c, crops, locale)}
                <input
                  id={`${id}-v-${c}`}
                  inputMode="decimal"
                  className="mt-1 h-11 w-full rounded-sm border border-border-strong bg-surface px-2 text-sm tabular-nums text-ink md:h-9"
                  value={values[c] ?? ""}
                  onChange={(e) => setValues((p) => ({ ...p, [c]: e.target.value }))}
                />
              </label>
            ))}
          </div>
        </fieldset>
        {error && (
          <p role="alert" className="text-xs text-danger">
            {error}
          </p>
        )}
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={apply} className="inline-flex h-11 items-center rounded-md bg-teal-700 px-4 text-sm font-medium text-white hover:bg-teal-600 md:h-10">
            {t("farmer.apply")}
          </button>
          {value && (
            <button
              type="button"
              onClick={() => {
                onApply(null);
                setSoil({ sand_pct: "", clay_pct: "", organic_carbon_pct: "", available_water_mm_per_m: "" });
                setValues({});
              }}
              className="inline-flex h-11 items-center rounded-md border border-border-strong px-4 text-sm font-medium text-ink hover:bg-sunken md:h-10"
            >
              {t("farmer.clear")}
            </button>
          )}
        </div>
      </div>
    </details>
  );
}

/** Which inputs the scores rest on and where each came from, as the engine reports it. */
export function InputSources({ inputs }: { inputs: InputSource[] }) {
  const { t, n } = useI18n();
  const shown = inputs.filter((i) => i.source === "farmer" || i.name.startsWith("soil."));
  if (!shown.length) return null;
  const fmt = (v: number | string) => (typeof v === "number" ? n(v, Number.isInteger(v) ? 0 : 2) : v);
  return (
    <div className="mb-4 overflow-x-auto rounded-md border border-border bg-surface" data-testid="input-sources">
      <table className="w-full text-xs">
        <caption className="px-3 pt-3 text-left text-sm font-semibold text-ink">{t("farmer.sources.title")}</caption>
        <thead className="text-left text-ink-2">
          <tr>
            <th scope="col" className="px-3 py-2 font-medium">{t("farmer.sources.input")}</th>
            <th scope="col" className="px-3 py-2 font-medium">{t("farmer.sources.value")}</th>
            <th scope="col" className="px-3 py-2 font-medium">{t("farmer.sources.source")}</th>
            <th scope="col" className="px-3 py-2 font-medium">{t("farmer.sources.replaces")}</th>
          </tr>
        </thead>
        <tbody>
          {shown.map((i) => (
            <tr key={i.name} className="border-t border-border">
              <th scope="row" className="px-3 py-2 text-left font-medium" lang="en">
                {i.name}
              </th>
              <td className="px-3 py-2 tabular-nums">
                {fmt(i.value)} {i.unit}
              </td>
              <td className={`px-3 py-2 ${i.source === "farmer" ? "font-semibold text-teal-700" : "text-ink-2"}`}>{t(`farmer.source.${i.source}` as MessageKey)}</td>
              <td className="px-3 py-2 text-ink-2" lang="en">
                {i.replaces || "—"}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
