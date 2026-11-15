"use client";

import { Sprout } from "lucide-react";
import { useI18n, type Locale, type MessageKey } from "@/i18n";
import type { Crop } from "@/lib/api/types";
import { cropLabel } from "@/lib/localize-engine";

export function cropName(id: string, crops: Map<string, Crop> | undefined, locale: Locale = "en") {
  return cropLabel(id, crops?.get(id)?.name ?? id.replace(/_/g, " "), locale);
}

/** Crop sequence as a year-by-year timeline. Legumes carry an icon and a text label, not only colour. */
export function CropTimeline({ sequence, crops, compact = false }: { sequence: string[]; crops?: Map<string, Crop>; compact?: boolean }) {
  const { t, locale } = useI18n();
  return (
    <ol className={`grid grid-cols-2 gap-1.5 sm:grid-cols-[repeat(var(--n),minmax(0,1fr))] ${compact ? "" : "sm:gap-2"}`} style={{ "--n": sequence.length } as React.CSSProperties}>
      {sequence.map((id, i) => {
        const crop = crops?.get(id);
        return (
          <li key={`${id}-${i}`} className={`relative min-w-0 rounded-md border px-2 py-1.5 ${crop?.is_legume ? "border-teal-700/40 bg-teal-100" : "border-border bg-sunken"}`}>
            <span className="block text-[11px] font-medium uppercase leading-4 tracking-[0.04em] text-ink-muted">{t("explore.year", { n: i + 1 })}</span>
            <span className="block truncate text-sm font-semibold leading-5 text-ink" title={cropName(id, crops, locale)}>
              {cropName(id, crops, locale)}
            </span>
            {!compact && crop && (
              <span className="mt-0.5 flex items-center gap-1 text-[11px] leading-4 text-ink-2">
                {crop.is_legume && <Sprout aria-hidden className="size-3 shrink-0 text-teal-700" strokeWidth={1.75} />}
                <span className="truncate">{crop.is_legume ? t("explore.legume") : t(`explore.season.${crop.season}` as MessageKey)}</span>
              </span>
            )}
          </li>
        );
      })}
    </ol>
  );
}
