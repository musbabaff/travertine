"use client";

import { AxisBottom, AxisLeft } from "@visx/axis";
import { Group } from "@visx/group";
import { scaleBand, scaleLinear } from "@visx/scale";
import { useState } from "react";
import { useI18n } from "@/i18n";
import type { Rotation } from "@/lib/api/types";
import { useWidth } from "@/lib/hooks/use-width";

const HEIGHT = 180;
const M = { top: 24, right: 8, bottom: 30, left: 44 };
const tick = { fill: "var(--color-ink-muted)", fontSize: 11, fontFamily: "var(--font-plex)" } as const;

/**
 * Per-year water demand (outlined bar) vs deficit (solid bar).
 * `yMax` lets two charts share a scale in the comparison view.
 */
export function WaterYearsChart({ yearly, cropLabel, irrigated, yMax }: { yearly: Rotation["yearly"]; cropLabel: (id: string) => string; irrigated: boolean; yMax?: number }) {
  const { t, n } = useI18n();
  const [box, width] = useWidth<HTMLDivElement>();
  const [table, setTable] = useState(false);
  const deficitLabel = irrigated ? t("chart.water.irrigation") : t("chart.water.deficit");
  const totalDemand = yearly.reduce((a, y) => a + y.water_demand_mm, 0);
  const totalDeficit = yearly.reduce((a, y) => a + y.water_deficit_mm, 0);
  const iw = Math.max(0, width - M.left - M.right);
  const ih = HEIGHT - M.top - M.bottom;
  const x = scaleBand({ domain: yearly.map((y) => y.year_index), range: [0, iw], padding: 0.3 });
  const y = scaleLinear({ domain: [0, (yMax ?? Math.max(...yearly.map((d) => d.water_demand_mm))) * 1.05], range: [ih, 0], nice: true });

  return (
    <figure>
      <div className="mb-1 flex flex-wrap gap-x-4 gap-y-1 text-xs text-ink-2" aria-hidden>
        <span className="inline-flex items-center gap-1.5">
          <span className="inline-block size-2.5 rounded-[2px] border-[1.5px] border-[var(--viz-water)]" />
          {t("chart.water.demand")}
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="inline-block size-2.5 rounded-[2px] bg-[var(--viz-risk)]" />
          {deficitLabel}
        </span>
      </div>
      <div ref={box} role="img" aria-label={t("chart.water.aria", { demand: n(totalDemand), deficit: n(totalDeficit) })} style={{ height: HEIGHT }}>
        {width > 0 && (
          <svg width={width} height={HEIGHT}>
            <Group left={M.left} top={M.top}>
              {y.ticks(4).map((v) => (
                <line key={v} x1={0} x2={iw} y1={y(v)} y2={y(v)} stroke="var(--viz-grid)" />
              ))}
              {yearly.map((d) => {
                const x0 = x(d.year_index) ?? 0, bw = x.bandwidth();
                const labelInside = ih - y(d.water_deficit_mm) > 16;
                return (
                  <g key={d.year_index}>
                    <rect x={x0 + 0.75} y={y(d.water_demand_mm)} width={bw - 1.5} height={ih - y(d.water_demand_mm)} fill="none" stroke="var(--viz-water)" strokeWidth={1.5} rx={2} />
                    <rect x={x0 + bw * 0.2} y={y(d.water_deficit_mm)} width={bw * 0.6} height={ih - y(d.water_deficit_mm)} fill="var(--viz-risk)" rx={1.5} />
                    <text x={x0 + bw / 2} y={y(d.water_demand_mm) - 5} textAnchor="middle" fontSize={11} fontWeight={600} fill="var(--color-ink)">
                      {n(d.water_demand_mm)}
                    </text>
                    {d.water_deficit_mm > 0 && (
                      <text x={x0 + bw / 2} y={labelInside ? y(d.water_deficit_mm) + 12 : y(d.water_deficit_mm) - 4} textAnchor="middle" fontSize={10} fontWeight={600} fill={labelInside ? "#ffffff" : "var(--viz-risk)"}>
                        {n(d.water_deficit_mm)}
                      </text>
                    )}
                  </g>
                );
              })}
              <AxisLeft scale={y} numTicks={4} hideAxisLine hideTicks tickFormat={(v) => n(Number(v))} tickLabelProps={() => ({ ...tick, textAnchor: "end", dx: -4, dy: "0.32em" })} />
              <AxisBottom
                top={ih}
                scale={x}
                hideTicks
                stroke="var(--color-border-strong)"
                tickFormat={(i) => (width < 360 ? String(i) : t("explore.year", { n: Number(i) }))}
                tickLabelProps={() => ({ ...tick, textAnchor: "middle" })}
              />
              <text x={-M.left} y={-12} fontSize={11} fill="var(--color-ink-muted)">
                {t("chart.axis.mm")}
              </text>
            </Group>
          </svg>
        )}
      </div>
      <button type="button" aria-expanded={table} onClick={() => setTable((v) => !v)} className="mt-1 min-h-6 rounded-sm text-xs font-medium text-teal-700 underline-offset-2 hover:underline">
        {table ? t("summary.table.hide") : t("summary.table.show")}
      </button>
      {table && (
        <div className="mt-2 overflow-x-auto rounded-md border border-border">
          <table className="w-full text-sm tabular-nums">
            <thead className="bg-sunken text-xs text-ink-2">
              <tr>
                <th scope="col" className="px-3 py-1.5 text-left font-medium">{t("chart.axis.year")}</th>
                <th scope="col" className="px-3 py-1.5 text-left font-medium">{t("chart.table.crop")}</th>
                <th scope="col" className="px-3 py-1.5 text-right font-medium">{t("chart.water.demand")} (mm)</th>
                <th scope="col" className="px-3 py-1.5 text-right font-medium">{deficitLabel} (mm)</th>
                <th scope="col" className="px-3 py-1.5 text-right font-medium">{t("chart.table.stress")}</th>
              </tr>
            </thead>
            <tbody>
              {yearly.map((d) => (
                <tr key={d.year_index} className="border-t border-border">
                  <th scope="row" className="px-3 py-1 text-left font-normal">{d.year_index}</th>
                  <td className="px-3 py-1">{cropLabel(d.crop_id)}</td>
                  <td className="px-3 py-1 text-right">{n(d.water_demand_mm)}</td>
                  <td className="px-3 py-1 text-right">{n(d.water_deficit_mm)}</td>
                  <td className="px-3 py-1 text-right">{n(d.stress_index, 2)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </figure>
  );
}
