"use client";

import { MapPin } from "lucide-react";
import Link from "next/link";
import { useI18n, type MessageKey } from "@/i18n";
import { pickable, useShowcase } from "./use-showcase";

/** Links to the multi-site validation fields; each opens on the given page with its coordinates. */
export function ShowcasePicker({ page = "/app", compact = false }: { page?: string; compact?: boolean }) {
  const { t } = useI18n();
  const q = useShowcase();
  if (!q.data || q.data.fromFixture) return null;
  const fields = pickable(q.data.data.fields);
  if (!fields.length) return null;
  return (
    <section aria-labelledby="showcase-title" className={compact ? "" : "tv-card rounded-md border border-border bg-surface p-4"} data-testid="showcase-picker">
      <h2 id="showcase-title" className="text-sm font-semibold text-ink">
        {t("showcase.title")}
      </h2>
      <p className="mt-1 text-xs text-ink-muted">{t("showcase.body")}</p>
      <ul className="mt-3 flex flex-wrap gap-2">
        {fields.map((f) => (
          <li key={f.id}>
            <Link
              href={`${page}?lat=${f.lat}&lon=${f.lon}`}
              className="inline-flex min-h-11 items-center gap-1.5 rounded-full border border-border-strong bg-surface px-3 text-sm text-ink hover:border-teal-700 hover:text-teal-700 md:min-h-9"
            >
              <MapPin aria-hidden className="size-4" strokeWidth={1.5} />
              {f.name}
              <span className="sr-only">
                {" "}
                {t(`evidence.verdict.${f.validation.verdict}` as MessageKey)}
              </span>
            </Link>
          </li>
        ))}
      </ul>
      <p className="mt-3 text-xs text-ink-muted">{t("showcase.excluded")}</p>
    </section>
  );
}
