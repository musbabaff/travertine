"use client";

import { RotateCw } from "lucide-react";
import Link from "next/link";
import { BrandLockup } from "@/components/brand/logo";
import { useI18n } from "@/i18n";

export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const { t } = useI18n();
  return (
    <main id="main" className="mx-auto flex w-full max-w-xl flex-1 flex-col justify-center gap-4 px-4 py-24 md:px-6">
      <Link href="/" aria-label={t("nav.home")} className="mb-6 w-fit rounded-sm">
        <BrandLockup className="h-8" />
      </Link>
      <h1 className="text-h2 font-semibold tracking-[-0.01em] md:text-h1">{t("error.title")}</h1>
      <p className="text-body text-ink-2">{t("error.body")}</p>
      {error.digest && <p className="text-xs tabular-nums text-ink-muted">{error.digest}</p>}
      <button type="button" onClick={reset} className="inline-flex h-11 w-fit items-center gap-2 rounded-md bg-teal-700 px-5 text-sm font-medium text-white hover:bg-teal-600">
        <RotateCw aria-hidden className="size-4" strokeWidth={1.5} />
        {t("error.retry")}
      </button>
    </main>
  );
}
