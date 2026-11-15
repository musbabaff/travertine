"use client";

import { AxisBottom, AxisLeft } from "@visx/axis";
import { Group } from "@visx/group";
import { scaleBand, scaleLinear } from "@visx/scale";
import type { KeyboardEvent } from "react";
import { useI18n } from "@/i18n";
import type { Validation } from "@/lib/api/types";
import { useWidth } from "@/lib/hooks/use-width";

type Year = Validation["years"][number];

const tick = { fill: "var(--color-ink-muted)", fontSize: 11, fontFamily: "var(--font-plex)" } as const;
const axisTitle = { fontSize: 11, fill: "var(--color-ink-muted)" } as const;

/** Diverging colour for an NDVI anomaly: risk below zero, water above (data-viz skill §2). */
const anomalyColor = (v: number) => (v < 0 ? "var(--viz-risk)" : "var(--viz-water)");

/** Arrow keys move the active year; Home/End jump to the ends. One tab stop per chart. */
function useYearKeys(count: number, active: number | null, onActive: (i: number | null) => void) {
  return (e: KeyboardEvent) => {
    const cur = active ?? -1;
    const next = { ArrowRight: cur + 1, ArrowUp: cur + 1, ArrowLeft: cur - 1, ArrowDown: cur - 1, Home: 0, End: count - 1 }[e.key];
    if (next === undefined) return;
    e.preventDefault();
    onActive(Math.max(0, Math.min(count - 1, next)));
  };
}

const symmetric = (vals: number[]) => {
  const m = Math.max(1, ...vals.map(Math.abs));
  return [-m, m] as [number, number];
};

interface Props {
  years: Year[];
  active: number | null;
  onActive: (i: number | null) => void;
  label: string;
}

/**
 * Paired series by year: modelled stress (line, fitted domain) above, observed NDVI anomaly (diverging bars from zero)
 * below, on one shared year axis so viewers can compare years directly.
 */
export function BacktestSeries({ years, active, onActive, label }: Props) {
  const { t, n } = useI18n();
  const [box, width] = useWidth<HTMLDivElement>();
  const onKey = useYearKeys(years.length, active, onActive);
  const narrow = width < 560;
  const M = { top: 22, right: 8, bottom: 28, left: 44 };
  const topH = 110, gap = 34, botH = 130;
  const height = M.top + topH + gap + botH + M.bottom;
  const iw = Math.max(0, width - M.left - M.right);
  const x = scaleBand({ domain: years.map((y) => y.year), range: [0, iw], padding: 0.25 });
  const base = years.map((y) => y.baseline_index).filter((v): v is number => v !== undefined);
  const stress = [...years.map((y) => y.modelled_stress), ...base];
  const sMin = Math.min(...stress), sMax = Math.max(...stress);
  const pad = Math.max(0.02, (sMax - sMin) * 0.15);
  const ys = scaleLinear({ domain: [Math.max(0, sMin - pad), Math.min(1, sMax + pad)], range: [topH, 0], nice: true });
  const ya = scaleLinear({ domain: symmetric(years.map((y) => y.observed_ndvi_anomaly)), range: [botH, 0], nice: true });
  const cx = (yr: number) => (x(yr) ?? 0) + x.bandwidth() / 2;
  const every = narrow ? 5 : 2;
  const path = years.map((d, i) => `${i ? "L" : "M"}${cx(d.year)},${ys(d.modelled_stress)}`).join("");

  return (
    <div
      ref={box}
      role="img"
      aria-label={label}
      tabIndex={0}
      onKeyDown={onKey}
      onPointerLeave={() => onActive(null)}
      className="rounded-sm"
      style={{ height }}
    >
      {width > 0 && (
        <svg width={width} height={height}>
          <Group left={M.left} top={M.top}>
            {/* Hover bands */}
            {years.map((d, i) => (
              <rect
                key={`h${d.year}`}
                x={(x(d.year) ?? 0) - (x.step() - x.bandwidth()) / 2}
                y={-M.top}
                width={x.step()}
                height={topH + gap + botH + M.top}
                fill={active === i ? "var(--color-sunken)" : "transparent"}
                onPointerEnter={() => onActive(i)}
              />
            ))}

            {/* Top: modelled stress */}
            <text x={-M.left} y={-10} {...axisTitle}>
              {base.length ? t("evidence.axis.index") : t("evidence.axis.stress")}
            </text>
            {ys.ticks(3).map((v) => (
              <line key={`s${v}`} x1={0} x2={iw} y1={ys(v)} y2={ys(v)} stroke="var(--viz-grid)" />
            ))}
            {base.length === years.length && (
              <path
                d={years.map((d, i) => `${i ? "L" : "M"}${cx(d.year)},${ys(d.baseline_index!)}`).join("")}
                fill="none"
                stroke="var(--viz-neutral)"
                strokeWidth={1.5}
                strokeDasharray="4 3"
                pointerEvents="none"
              />
            )}
            <path d={path} fill="none" stroke="var(--viz-model)" strokeWidth={1.75} pointerEvents="none" />
            {years.map((d, i) => (
              <circle key={`p${d.year}`} cx={cx(d.year)} cy={ys(d.modelled_stress)} r={active === i ? 4.5 : 3} fill="var(--viz-model)" pointerEvents="none" />
            ))}
            <AxisLeft scale={ys} numTicks={3} hideAxisLine hideTicks tickFormat={(v) => n(Number(v), 2)} tickLabelProps={() => ({ ...tick, textAnchor: "end", dx: -4, dy: "0.32em" })} />

            {/* Bottom: observed NDVI anomaly */}
            <Group top={topH + gap}>
              <text x={-M.left} y={-10} {...axisTitle}>
                {t("evidence.axis.anomaly")}
              </text>
              {ya.ticks(4).map((v) => (
                <line key={`a${v}`} x1={0} x2={iw} y1={ya(v)} y2={ya(v)} stroke={v === 0 ? "var(--color-border-strong)" : "var(--viz-grid)"} />
              ))}
              {years.map((d, i) => {
                const v = d.observed_ndvi_anomaly;
                return (
                  <rect
                    key={`b${d.year}`}
                    x={x(d.year) ?? 0}
                    y={Math.min(ya(v), ya(0))}
                    width={x.bandwidth()}
                    height={Math.abs(ya(v) - ya(0))}
                    fill={anomalyColor(v)}
                    opacity={active === null || active === i ? 1 : 0.55}
                    rx={1}
                    pointerEvents="none"
                  />
                );
              })}
              <AxisLeft scale={ya} numTicks={4} hideAxisLine hideTicks tickFormat={(v) => n(Number(v), 1)} tickLabelProps={() => ({ ...tick, textAnchor: "end", dx: -4, dy: "0.32em" })} />
              <AxisBottom
                top={botH}
                scale={x}
                hideTicks
                stroke="var(--color-border-strong)"
                tickValues={years.map((y) => y.year).filter((yr, i) => i % every === 0)}
                tickFormat={(v) => String(v)}
                tickLabelProps={() => ({ ...tick, textAnchor: "middle" })}
              />
            </Group>
          </Group>
        </svg>
      )}
    </div>
  );
}

/** Each year as one point: modelled stress (x) against observed NDVI anomaly (y). No fitted line (data-viz §4). */
export function BacktestScatter({ years, active, onActive, label }: Props) {
  const { t, n } = useI18n();
  const [box, width] = useWidth<HTMLDivElement>();
  const onKey = useYearKeys(years.length, active, onActive);
  const M = { top: 22, right: 12, bottom: 40, left: 44 };
  const height = Math.min(320, Math.max(240, width * 0.75));
  const iw = Math.max(0, width - M.left - M.right);
  const ih = height - M.top - M.bottom;
  const stress = years.map((y) => y.modelled_stress);
  const pad = Math.max(0.02, (Math.max(...stress) - Math.min(...stress)) * 0.1);
  const x = scaleLinear({ domain: [Math.max(0, Math.min(...stress) - pad), Math.min(1, Math.max(...stress) + pad)], range: [0, iw], nice: true });
  const y = scaleLinear({ domain: symmetric(years.map((d) => d.observed_ndvi_anomaly)), range: [ih, 0], nice: true });

  return (
    <div
      ref={box}
      role="img"
      aria-label={label}
      tabIndex={0}
      onKeyDown={onKey}
      onPointerLeave={() => onActive(null)}
      className="rounded-sm"
      style={{ height }}
    >
      {width > 0 && (
        <svg width={width} height={height}>
          <Group left={M.left} top={M.top}>
            <text x={-M.left} y={-10} {...axisTitle}>
              {t("evidence.axis.anomaly")}
            </text>
            {y.ticks(4).map((v) => (
              <line key={v} x1={0} x2={iw} y1={y(v)} y2={y(v)} stroke={v === 0 ? "var(--color-border-strong)" : "var(--viz-grid)"} />
            ))}
            {years.map((d, i) => (
              <circle
                key={d.year}
                cx={x(d.modelled_stress)}
                cy={y(d.observed_ndvi_anomaly)}
                r={active === i ? 6 : 4.5}
                fill={active === i ? "var(--viz-observed)" : "var(--color-surface)"}
                stroke="var(--viz-observed)"
                strokeWidth={1.5}
                onPointerEnter={() => onActive(i)}
              />
            ))}
            {active !== null && years[active] && (
              <text
                x={x(years[active].modelled_stress)}
                y={y(years[active].observed_ndvi_anomaly) - 10}
                textAnchor={x(years[active].modelled_stress) > iw - 24 ? "end" : "middle"}
                fontSize={11}
                fontWeight={600}
                fill="var(--color-ink)"
                pointerEvents="none"
              >
                {years[active].year}
              </text>
            )}
            <AxisLeft scale={y} numTicks={4} hideAxisLine hideTicks tickFormat={(v) => n(Number(v), 1)} tickLabelProps={() => ({ ...tick, textAnchor: "end", dx: -4, dy: "0.32em" })} />
            <AxisBottom top={ih} scale={x} numTicks={width < 400 ? 4 : 6} hideTicks stroke="var(--color-border-strong)" tickFormat={(v) => n(Number(v), 2)} tickLabelProps={() => ({ ...tick, textAnchor: "middle" })} />
            <text x={iw} y={ih + 34} textAnchor="end" {...axisTitle}>
              {t("evidence.axis.stress")}
            </text>
          </Group>
        </svg>
      )}
    </div>
  );
}

/** Where r sits on −1…1, with zero marked. */
export function CorrelationScale({ r }: { r: number }) {
  const { t, n } = useI18n();
  const pos = ((r + 1) / 2) * 100;
  return (
    <div aria-hidden className="mt-3">
      <div className="relative h-2 rounded-full bg-sunken">
        <span className="absolute inset-y-[-3px] left-1/2 w-px bg-border-strong" />
        <span className="absolute top-1/2 size-3.5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-surface bg-teal-700 shadow-1" style={{ left: `${pos}%` }} />
      </div>
      <div className="mt-1 flex justify-between text-xs tabular-nums text-ink-muted">
        <span>{n(-1, 0)}</span>
        <span>{t("evidence.r.none")}</span>
        <span>{n(1, 0)}</span>
      </div>
    </div>
  );
}
