"use client";

import { AxisBottom, AxisLeft } from "@visx/axis";
import { Group } from "@visx/group";
import { scaleBand, scaleLinear } from "@visx/scale";
import { Bar, LinePath } from "@visx/shape";
import { useState } from "react";
import { useI18n } from "@/i18n";
import type { ClimateYear } from "@/lib/api/types";
import { useWidth } from "@/lib/hooks/use-width";

const HEIGHT = 200;
const M = { top: 28, right: 40, bottom: 34, left: 48 };
const tickLabel = { fill: "var(--color-ink-muted)", fontSize: 11, fontFamily: "var(--font-plex)" } as const;

function Plot({ data, width }: { data: ClimateYear[]; width: number }) {
  const { t, n } = useI18n();
  const [hover, setHover] = useState<number | null>(null);
  const iw = Math.max(0, width - M.left - M.right);
  const ih = HEIGHT - M.top - M.bottom;
  const x = scaleBand({ domain: data.map((d) => d.year), range: [0, iw], padding: 0.25 });
  const max = Math.max(...data.map((d) => Math.max(d.precipitation_mm, d.et0_mm)));
  const y = scaleLinear({ domain: [0, max * 1.08], range: [ih, 0], nice: true });
  const step = width < 420 ? 6 : width < 640 ? 4 : 2;
  const last = data[data.length - 1];
  const active = hover !== null ? data[hover] : null;

  return (
    <svg width={width} height={HEIGHT} className="overflow-visible">
      <Group left={M.left} top={M.top}>
        {y.ticks(4).map((v) => (
          <line key={v} x1={0} x2={iw} y1={y(v)} y2={y(v)} stroke="var(--viz-grid)" />
        ))}
        {data.map((d, i) => (
          <Bar
            key={d.year}
            x={x(d.year)}
            y={y(d.precipitation_mm)}
            width={x.bandwidth()}
            height={ih - y(d.precipitation_mm)}
            fill="var(--viz-water)"
            opacity={hover === null || hover === i ? 1 : 0.45}
            rx={1.5}
          />
        ))}
        <LinePath data={data} x={(d) => (x(d.year) ?? 0) + x.bandwidth() / 2} y={(d) => y(d.et0_mm)} stroke="var(--viz-risk)" strokeWidth={2} strokeDasharray="5 3" />
        {/* Direct label at the line end instead of a legend */}
        <text x={(x(last.year) ?? 0) + x.bandwidth() + 4} y={y(last.et0_mm)} dy="0.32em" fontSize={11} fontWeight={600} fill="var(--viz-risk)">
          {t("chart.legend.et0")}
        </text>
        {data.map((d, i) => (
          <rect
            key={d.year}
            x={(x(d.year) ?? 0) - (x.step() - x.bandwidth()) / 2}
            y={0}
            width={x.step()}
            height={ih}
            fill="transparent"
            onPointerEnter={() => setHover(i)}
            onPointerLeave={() => setHover(null)}
          />
        ))}
        <AxisLeft scale={y} numTicks={4} hideAxisLine hideTicks tickFormat={(v) => n(Number(v))} tickLabelProps={() => ({ ...tickLabel, textAnchor: "end", dx: -4, dy: "0.32em" })} />
        <AxisBottom
          top={ih}
          scale={x}
          hideTicks
          stroke="var(--color-border-strong)"
          tickValues={data.map((d) => d.year).filter((_, i) => i % step === 0)}
          tickLabelProps={() => ({ ...tickLabel, textAnchor: "middle" })}
        />
        <text x={-M.left} y={-16} fontSize={11} fill="var(--color-ink-muted)">
          {t("chart.axis.mm")}
        </text>
        {active && (
          <g transform={`translate(${Math.max(58 - M.left, Math.min((x(active.year) ?? 0) + x.bandwidth() / 2, iw - 70))}, 4)`} pointerEvents="none">
            <rect x={-58} width={128} height={44} rx={6} fill="var(--color-navy-900)" />
            <text x={-50} y={16} fontSize={11} fontWeight={600} fill="#eee8dc">
              {active.year}
            </text>
            <text x={-50} y={32} fontSize={11} fill="#eee8dc">
              {`${n(active.precipitation_mm)} / ${n(active.et0_mm)} mm`}
            </text>
          </g>
        )}
      </Group>
    </svg>
  );
}

export function WaterBalanceChart({ data }: { data: ClimateYear[] }) {
  const { t, n } = useI18n();
  const [table, setTable] = useState(false);
  const [box, width] = useWidth<HTMLDivElement>();
  if (data.length === 0) return null;
  const meanP = data.reduce((a, d) => a + d.precipitation_mm, 0) / data.length;
  const meanE = data.reduce((a, d) => a + d.et0_mm, 0) / data.length;
  const aria = t("summary.balance.aria", { from: data[0].year, to: data[data.length - 1].year, p: n(meanP), e: n(meanE) });

  return (
    <figure>
      <div role="img" aria-label={aria}>
        <div className="mb-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-ink-2" aria-hidden>
          <span className="inline-flex items-center gap-1.5">
            <span className="inline-block size-2.5 rounded-[2px] bg-[var(--viz-water)]" />
            {t("chart.legend.precip")}
          </span>
          <span className="inline-flex items-center gap-1.5">
            <svg width="16" height="4" aria-hidden>
              <line x1="0" x2="16" y1="2" y2="2" stroke="var(--viz-risk)" strokeWidth="2" strokeDasharray="4 2" />
            </svg>
            {t("chart.legend.et0")}
          </span>
        </div>
        <div ref={box} style={{ height: HEIGHT }}>
          {width > 0 && <Plot data={data} width={width} />}
        </div>
      </div>
      <figcaption className="mt-2 flex flex-wrap items-center justify-between gap-2 text-xs text-ink-2">
        <span>{meanE >= meanP ? t("summary.balance.gap", { gap: n(meanE - meanP) }) : t("summary.balance.surplus", { gap: n(meanP - meanE) })}</span>
        <button type="button" aria-expanded={table} onClick={() => setTable((v) => !v)} className="min-h-6 rounded-sm font-medium text-teal-700 underline-offset-2 hover:underline">
          {table ? t("summary.table.hide") : t("summary.table.show")}
        </button>
      </figcaption>
      {table && (
        <div className="mt-2 max-h-64 overflow-auto rounded-md border border-border">
          <table className="w-full text-sm tabular-nums">
            <thead className="sticky top-0 bg-sunken text-xs text-ink-2">
              <tr>
                <th scope="col" className="px-3 py-1.5 text-left font-medium">{t("summary.table.year")}</th>
                <th scope="col" className="px-3 py-1.5 text-right font-medium">{t("chart.legend.precip")} (mm)</th>
                <th scope="col" className="px-3 py-1.5 text-right font-medium">{t("chart.legend.et0")} (mm)</th>
              </tr>
            </thead>
            <tbody>
              {data.map((d) => (
                <tr key={d.year} className="border-t border-border">
                  <th scope="row" className="px-3 py-1 text-left font-normal">{d.year}</th>
                  <td className="px-3 py-1 text-right">{n(d.precipitation_mm)}</td>
                  <td className="px-3 py-1 text-right">{n(d.et0_mm)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </figure>
  );
}
