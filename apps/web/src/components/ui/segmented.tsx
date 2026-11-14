"use client";

import { useId, type KeyboardEvent } from "react";

interface Option<T extends string> {
  value: T;
  label: string;
}

/** Radio-group styled as a segmented control. Arrow keys move the selection. */
export function Segmented<T extends string>({
  label,
  options,
  value,
  onChange,
  hideLabel = false,
  className = "",
}: {
  label: string;
  options: Option<T>[];
  value: T;
  onChange: (v: T) => void;
  hideLabel?: boolean;
  className?: string;
}) {
  const id = useId();
  const onKey = (e: KeyboardEvent) => {
    const i = options.findIndex((o) => o.value === value);
    const step = e.key === "ArrowRight" || e.key === "ArrowDown" ? 1 : e.key === "ArrowLeft" || e.key === "ArrowUp" ? -1 : 0;
    if (!step) return;
    e.preventDefault();
    const next = options[(i + step + options.length) % options.length];
    onChange(next.value);
    document.getElementById(`${id}-${next.value}`)?.focus();
  };
  return (
    <div className={className}>
      <span id={`${id}-label`} className={hideLabel ? "sr-only" : "mb-1.5 block text-xs font-medium text-ink-2"}>
        {label}
      </span>
      <div role="radiogroup" aria-labelledby={`${id}-label`} onKeyDown={onKey} className="inline-flex w-full rounded-md border border-border-strong bg-sunken p-0.5">
        {options.map((o) => {
          const active = o.value === value;
          return (
            <button
              key={o.value}
              id={`${id}-${o.value}`}
              type="button"
              role="radio"
              aria-checked={active}
              tabIndex={active ? 0 : -1}
              onClick={() => onChange(o.value)}
              className={`min-h-9 flex-1 rounded-[5px] px-3 text-sm font-medium transition-colors duration-[var(--dur-fast)] ${
                active ? "bg-surface text-ink shadow-1" : "text-ink-2 hover:text-ink"
              }`}
            >
              {o.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
