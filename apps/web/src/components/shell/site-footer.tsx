"use client";

import Link from "next/link";
import { BrandMark } from "@/components/brand/logo";
import { useI18n } from "@/i18n";

const REPO = "https://github.com/musbabaff/travertine";

/** Shared footer: mark, independence disclaimer, source link. */
export function SiteFooter() {
  const { t } = useI18n();
  return (
    <footer className="border-t border-border bg-surface">
      <div className="mx-auto flex w-full max-w-[1280px] flex-col gap-3 px-4 py-6 text-xs text-ink-muted md:flex-row md:items-center md:gap-6 md:px-6 xl:px-8">
        <Link href="/" aria-label={t("nav.home")} className="w-fit rounded-sm">
          <BrandMark className="h-5" />
        </Link>
        <p className="max-w-[80ch]">{t("footer.disclaimer")}</p>
        <a href={REPO} className="w-fit rounded-sm font-medium text-teal-700 underline-offset-2 hover:underline md:ml-auto">
          {t("footer.source")}
        </a>
      </div>
    </footer>
  );
}
