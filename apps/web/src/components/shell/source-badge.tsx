"use client";

import { useI18n } from "@/i18n";
import { useDataSource } from "@/lib/api/source";

/** Always-visible, honest indicator of where the numbers on screen come from. */
export function SourceBadge() {
  const { t } = useI18n();
  const source = useDataSource();
  if (source === "engine") {
    return (
      <span data-testid="live-badge" title={t("source.live.desc")} className="inline-flex h-7 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full border border-border px-2.5 text-xs font-medium text-ink-2">
        <span aria-hidden className="size-1.5 rounded-full bg-teal-700" />
        {t("source.live")}
        <span className="sr-only">. {t("source.live.desc")}</span>
      </span>
    );
  }
  const key = source === "fallback" ? "source.fallback" : "source.demo";
  return (
    <span
      data-testid="demo-badge"
      title={t(`${key}.desc`)}
      className="inline-flex h-7 min-w-0 items-center gap-1.5 rounded-full border border-warning bg-warning-bg px-2.5 text-xs font-medium text-warning"
    >
      <span aria-hidden className="size-1.5 shrink-0 rounded-full bg-warning" />
      <span className="whitespace-nowrap sm:hidden">{t("source.demo")}</span>
      <span className="hidden whitespace-nowrap sm:inline">{t(key)}</span>
      <span className="sr-only">. {t(`${key}.desc`)}</span>
    </span>
  );
}
