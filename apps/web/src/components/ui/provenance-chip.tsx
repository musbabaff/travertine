"use client";

import { ExternalLink, X } from "lucide-react";
import { useEffect, useId, useRef, useState } from "react";
import { useI18n } from "@/i18n";
import type { Provenance } from "@/lib/api/types";

/** Short dataset label for the chip, e.g. "NASA POWER · 0.5° × 0.625°". */
export function shortName(p: Provenance): string {
  const known: [RegExp, string][] = [
    [/POWER/i, "NASA POWER"],
    [/SoilGrids/i, "SoilGrids"],
    [/MOD13|MODIS/i, "MODIS NDVI"],
    [/VIIRS/i, "VIIRS"],
    [/SMAP/i, "SMAP"],
    [/FAO/i, "FAO-56"],
    [/CHIRPS/i, "CHIRPS"],
    [/IMERG|GPM/i, "GPM IMERG"],
    [/ERA5/i, "ERA5"],
  ];
  return known.find(([re]) => re.test(p.dataset))?.[1] ?? p.dataset.split(/[(,—]/)[0].trim();
}

/** Picks the provenance items relevant to a section by dataset keywords; falls back to all items. */
export function pickProvenance(items: Provenance[], pattern: RegExp): Provenance[] {
  const hits = items.filter((p) => pattern.test(`${p.dataset} ${p.note}`));
  return hits.length ? hits : items;
}

export function ProvenanceChips({ items }: { items: Provenance[] }) {
  return (
    <span className="inline-flex flex-wrap gap-1.5">
      {items.map((p) => (
        <ProvenanceChip key={p.dataset} item={p} />
      ))}
    </span>
  );
}

export function ProvenanceChip({ item }: { item: Provenance }) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const id = useId();
  const root = useRef<HTMLSpanElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const name = shortName(item);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => !root.current?.contains(e.target as Node) && setOpen(false);
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpen(false);
        trigger.current?.focus();
      }
    };
    document.addEventListener("pointerdown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <span ref={root} className="relative inline-block">
      <button
        ref={trigger}
        type="button"
        aria-expanded={open}
        aria-controls={id}
        onClick={() => setOpen((v) => !v)}
        className="inline-flex min-h-6 items-center gap-1 rounded-sm bg-sunken px-1.5 text-xs font-medium text-ink-muted hover:text-ink"
      >
        <span className="truncate">{name}</span>
        <span className="whitespace-nowrap text-ink-muted">· {item.spatial_resolution.split(" (")[0]}</span>
        <span className="sr-only">, {t("provenance.label")}</span>
      </button>
      {open && (
        <div
          id={id}
          role="dialog"
          aria-label={item.dataset}
          className="absolute left-0 top-full z-30 mt-1.5 w-[min(22rem,calc(100vw-2rem))] rounded-lg border border-border bg-surface p-4 text-left shadow-3"
        >
          <div className="flex items-start justify-between gap-3">
            <p className="text-sm font-semibold text-ink">{item.dataset}</p>
            <button type="button" onClick={() => setOpen(false)} aria-label={t("provenance.close")} className="-m-1 rounded-sm p-1 text-ink-muted hover:text-ink">
              <X aria-hidden className="size-4" strokeWidth={1.5} />
            </button>
          </div>
          <dl className="mt-2 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-xs">
            <dt className="text-ink-muted">{t("provenance.provider")}</dt>
            <dd className="text-ink-2">{item.provider}</dd>
            <dt className="text-ink-muted">{t("provenance.resolution")}</dt>
            <dd className="text-ink-2">{item.spatial_resolution}</dd>
            <dt className="text-ink-muted">{t("provenance.coverage")}</dt>
            <dd className="text-ink-2">{item.temporal_coverage}</dd>
          </dl>
          {item.note && (
            <p className="mt-2 text-xs text-ink-2">
              <span className="text-ink-muted">{t("provenance.note")}: </span>
              {item.note}
            </p>
          )}
          <a href={item.access_url} target="_blank" rel="noreferrer" className="mt-3 inline-flex items-center gap-1 text-xs font-medium text-teal-700 underline-offset-2 hover:underline">
            {t("provenance.link")}
            <ExternalLink aria-hidden className="size-3.5" strokeWidth={1.5} />
          </a>
        </div>
      )}
    </span>
  );
}
