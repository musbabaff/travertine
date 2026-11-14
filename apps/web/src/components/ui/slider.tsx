"use client";

import { useId } from "react";

/** Native range input with a visible label, description and value (WCAG: keyboard + screen reader for free). */
export function Slider({
  label,
  description,
  value,
  valueText,
  onChange,
  color,
}: {
  label: string;
  description?: string;
  value: number;
  valueText: string;
  onChange: (v: number) => void;
  color: string;
}) {
  const id = useId();
  const pct = Math.round(value * 100);
  return (
    <div>
      <div className="flex items-baseline justify-between gap-3">
        <label htmlFor={id} className="text-sm font-medium text-ink">
          {label}
        </label>
        <span className="text-sm font-semibold tabular-nums text-ink" aria-hidden>
          {valueText}
        </span>
      </div>
      {description && (
        <p id={`${id}-d`} className="text-xs text-ink-muted">
          {description}
        </p>
      )}
      <input
        id={id}
        type="range"
        min={0}
        max={100}
        step={5}
        value={pct}
        aria-valuetext={valueText}
        aria-describedby={description ? `${id}-d` : undefined}
        onChange={(e) => onChange(Number(e.target.value) / 100)}
        className="tv-slider mt-2 w-full"
        style={{ "--fill": `${pct}%`, "--thumb": color } as React.CSSProperties}
      />
    </div>
  );
}
