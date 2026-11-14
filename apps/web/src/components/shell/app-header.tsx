"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { useI18n, type MessageKey } from "@/i18n";
import { Segmented } from "@/components/ui/segmented";
import { LogoMark } from "./logo";
import { SourceBadge } from "./source-badge";

/** Tabs are added here as each screen ships. */
export const APP_TABS: { href: string; key: MessageKey }[] = [{ href: "/app", key: "nav.field" }];

export function AppHeader() {
  const { t, locale, setLocale } = useI18n();
  const pathname = usePathname();
  const params = useSearchParams();
  const qs = params.toString();

  return (
    <header className="relative z-20 border-b border-border bg-surface">
      <div className="flex h-14 items-center gap-3 px-4 md:gap-6 md:px-6 xl:px-8">
        <Link href="/" className="flex shrink-0 items-center gap-2 rounded-sm text-ink">
          <LogoMark />
          <span className="text-h3 font-semibold tracking-[-0.01em]">{t("app.name")}</span>
        </Link>
        <nav aria-label={t("nav.label")} className="hidden h-full sm:flex">
          <ul className="flex h-full items-stretch gap-1">
            {APP_TABS.map((tab) => {
              const active = pathname === tab.href;
              return (
                <li key={tab.href} className="flex">
                  <Link
                    href={qs ? `${tab.href}?${qs}` : tab.href}
                    aria-current={active ? "page" : undefined}
                    className={`flex items-center border-b-2 px-3 text-sm font-medium ${
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
        <div className="ml-auto flex items-center gap-2 md:gap-3">
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
