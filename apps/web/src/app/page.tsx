"use client";

import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { BrandLockup } from "@/components/brand/logo";
import { SiteFooter } from "@/components/shell/site-footer";
import { useI18n } from "@/i18n";

/** Interim home page. The full landing page is Phase 2. */
export default function Home() {
  const { t } = useI18n();
  return (
    <>
    <main id="main" className="mx-auto flex w-full max-w-3xl flex-1 flex-col justify-center gap-5 px-4 py-24 md:px-6">
      <BrandLockup className="mb-4 h-9 self-start md:h-11" />
      <p className="text-xs font-medium uppercase tracking-[0.04em] text-ink-muted">{t("home.eyebrow")}</p>
      <h1 className="text-h1 font-semibold tracking-[-0.01em] md:text-[2.5rem] md:leading-[3rem]">{t("home.title")}</h1>
      <p className="max-w-[60ch] text-body text-ink-2">{t("home.body")}</p>
      <Link href="/app" className="inline-flex h-11 w-fit items-center gap-2 rounded-md bg-teal-700 px-5 text-sm font-medium text-white hover:bg-teal-600">
        {t("home.cta")}
        <ArrowRight aria-hidden className="size-4" strokeWidth={1.5} />
      </Link>
    </main>
    <SiteFooter />
    </>
  );
}
