"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { useI18n, type MessageKey } from "@/i18n";
import { Segmented } from "@/components/ui/segmented";
import { BrandLockup } from "@/components/brand/logo";
import { SourceBadge } from "./source-badge";

/** Tabs are added here as each screen ships. */
export const APP_TABS: { href: string; key: MessageKey }[] = [
  { href: "/app", key: "nav.field" },
  { href: "/app/explore", key: "nav.explore" },
  { href: "/app/evidence", key: "nav.evidence" },
];

export function AppHeader() {
  const { t, locale, setLocale } = useI18n();
  const pathname = usePathname();
  const params = useSearchParams();
  const qs = params.toString();

  return (
    <header className="relative z-20 border-b border-border bg-surface">
      <div className="flex flex-wrap items-center gap-x-3 px-4 sm:h-14 sm:flex-nowrap md:gap-x-6 md:px-6 xl:px-8">
        <Link href="/" aria-label={t("nav.home")} className="flex h-14 shrink-0 items-center rounded-sm">
          <BrandLockup className="h-6 sm:h-7" />
        </Link>
        <nav aria-label={t("nav.label")} className="order-last -mx-4 flex h-11 w-[calc(100%+2rem)] border-t border-border px-2 sm:order-none sm:mx-0 sm:h-full sm:w-auto sm:border-t-0 sm:px-0">
          <ul className="flex h-full items-stretch gap-1 overflow-x-auto">
            {APP_TABS.map((tab) => {
              const active = pathname === tab.href;
              return (
                <li key={tab.href} className="flex">
                  <Link
                    href={qs ? `${tab.href}?${qs}` : tab.href}
                    aria-current={active ? "page" : undefined}
                    className={`flex items-center whitespace-nowrap border-b-2 px-3 text-sm font-medium ${
                      active ? "border-teal-700 text-ink" : "border-transparent text-ink-2 hover:text-ink"
                    }`}
                  >
                    {t(tab.key)}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>
        <div className="ml-auto flex h-14 items-center gap-2 md:gap-3">
          <SourceBadge />
          <Segmented
            label={t("lang.label")}
            hideLabel
            className="w-[5.5rem]"
            value={locale}
            onChange={setLocale}
            options={[
              { value: "en", label: t("lang.en") },
              { value: "tr", label: t("lang.tr") },
            ]}
          />
        </div>
      </div>
    </header>
  );
}
