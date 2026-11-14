"use client";

import Link from "next/link";
import { BrandLockup } from "@/components/brand/logo";
import { SiteFooter } from "@/components/shell/site-footer";
import { useI18n } from "@/i18n";

export default function NotFound() {
  const { t } = useI18n();
  return (
    <>
      <main id="main" className="mx-auto flex w-full max-w-xl flex-1 flex-col justify-center gap-4 px-4 py-24 md:px-6">
        <Link href="/" aria-label={t("nav.home")} className="mb-6 w-fit rounded-sm">
          <BrandLockup className="h-8" />
        </Link>
        <p className="text-sm font-medium tabular-nums text-ink-muted">404</p>
        <h1 className="text-h2 font-semibold tracking-[-0.01em] md:text-h1">{t("notFound.title")}</h1>
        <p className="text-body text-ink-2">{t("notFound.body")}</p>
        <Link href="/" className="inline-flex h-11 w-fit items-center rounded-md bg-teal-700 px-5 text-sm font-medium text-white hover:bg-teal-600">
          {t("notFound.cta")}
        </Link>
      </main>
      <SiteFooter />
    </>
  );
}
