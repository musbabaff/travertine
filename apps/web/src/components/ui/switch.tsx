"use client";

import { useId } from "react";

export function Switch({ label, description, checked, onChange }: { label: string; description?: string; checked: boolean; onChange: (v: boolean) => void }) {
  const id = useId();
  return (
    <div className="flex items-start justify-between gap-4">
      <div className="min-w-0">
        <label htmlFor={id} className="text-sm font-medium text-ink">
          {label}
        </label>
        {description && (
          <p id={`${id}-d`} className="mt-0.5 text-xs text-ink-muted">
            {description}
          </p>
        )}
      </div>
      <button
        id={id}
        type="button"
        role="switch"
        aria-checked={checked}
        aria-describedby={description ? `${id}-d` : undefined}
        onClick={() => onChange(!checked)}
        className={`relative mt-0.5 inline-flex h-7 w-12 shrink-0 items-center rounded-full border transition-colors duration-[var(--dur-fast)] ${
          checked ? "border-teal-700 bg-teal-700" : "border-border-strong bg-sunken"
        }`}
      >
        <span
          aria-hidden
          className={`inline-block size-5 rounded-full bg-surface shadow-1 transition-transform duration-[var(--dur-base)] ease-[var(--ease-out)] ${
            checked ? "translate-x-[22px]" : "translate-x-[3px]"
          }`}
        />
      </button>
    </div>
  );
}
