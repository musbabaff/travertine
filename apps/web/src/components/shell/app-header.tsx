"use client";

import { ChartNoAxesCombined, ChevronDown, Database, Home, LayoutDashboard, Layers, Menu, Sprout, X } from "lucide-react";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { BrandLockup } from "@/components/brand/logo";
import { useI18n, type MessageKey } from "@/i18n";
import { SourceBadge } from "./source-badge";

type Page = { href: string; key: MessageKey; desc: MessageKey; icon: typeof Home; tour?: string };

/** Every page here has a real data source. Pages without one are not listed. */
const PAGES: Record<"overview" | "field" | "explore" | "evidence" | "data", Page> = {
  overview: { href: "/app/overview", key: "nav.overview", desc: "nav.overview.desc", icon: LayoutDashboard },
  field: { href: "/app", key: "nav.field", desc: "nav.field.desc", icon: Layers, tour: "field-nav" },
  explore: { href: "/app/explore", key: "nav.explore", desc: "nav.explore.desc", icon: Sprout },
  evidence: { href: "/app/evidence", key: "nav.evidence", desc: "nav.evidence.desc", icon: ChartNoAxesCombined, tour: "evidence-nav" },
  data: { href: "/app/data", key: "nav.data", desc: "nav.data.desc", icon: Database },
};
const GROUPS: { key: MessageKey; pages: Page[] }[] = [
  { key: "nav.group.field", pages: [PAGES.overview, PAGES.field] },
  { key: "nav.group.decide", pages: [PAGES.explore] },
  { key: "nav.group.science", pages: [PAGES.evidence, PAGES.data] },
];
const RAIL: Page[] = [{ href: "/", key: "nav.home.short", desc: "nav.home", icon: Home }, PAGES.overview, PAGES.field, PAGES.explore, PAGES.evidence, PAGES.data];
const BOTTOM: Page[] = [PAGES.overview, PAGES.field, PAGES.explore, PAGES.evidence];

export function AppHeader() {
  const { t, locale, setLocale } = useI18n();
  const pathname = usePathname();
  const params = useSearchParams();
  const [open, setOpen] = useState<string | null>(null);
  const header = useRef<HTMLElement>(null);
  const query = params.toString();
  const withField = (href: string) => (href === "/" || !query ? href : `${href}?${query}`);

  useEffect(() => {
    const dismiss = (e: PointerEvent) => !header.current?.contains(e.target as Node) && setOpen(null);
    const escape = (e: KeyboardEvent) => e.key === "Escape" && setOpen(null);
    document.addEventListener("pointerdown", dismiss);
    document.addEventListener("keydown", escape);
    return () => {
      document.removeEventListener("pointerdown", dismiss);
      document.removeEventListener("keydown", escape);
    };
  }, []);

  return (
    <>
      <a className="tv-skip" href="#main">
        {t("a11y.skip")}
      </a>
      <header className="tv-header" ref={header}>
        <Link href="/" className="tv-brand" aria-label={t("nav.home")} onClick={() => setOpen(null)}>
          <BrandLockup className="h-6 md:h-7" />
        </Link>
        <nav className="tv-topnav" aria-label={t("nav.label")}>
          {GROUPS.map((g) => {
            const id = `tv-menu-${g.key}`;
            return (
              <div className="tv-nav-group" key={g.key}>
                <button
                  type="button"
                  className={`tv-pill${g.pages.some((p) => p.href === pathname) ? " is-active" : ""}`}
                  aria-expanded={open === g.key}
                  aria-controls={id}
                  onClick={() => setOpen(open === g.key ? null : g.key)}
                >
                  {t(g.key)}
                  <ChevronDown aria-hidden size={17} />
                </button>
                {open === g.key && (
                  <div id={id} className="tv-dropdown">
                    <span className="tv-dropdown-label">{t(g.key)}</span>
                    {g.pages.map((p) => (
                      <Link key={p.href} href={withField(p.href)} onClick={() => setOpen(null)} aria-current={pathname === p.href ? "page" : undefined}>
                        <strong>{t(p.key)}</strong>
                        <small>{t(p.desc)}</small>
                      </Link>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </nav>
        <div className="tv-header-actions">
          <SourceBadge />
          <div
            role="radiogroup"
            aria-label={t("lang.label")}
            className="tv-lang"
            onKeyDown={(e) => {
              if (["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(e.key)) {
                e.preventDefault();
                const next = locale === "en" ? "tr" : "en";
                setLocale(next);
                e.currentTarget.querySelector<HTMLButtonElement>(`[data-lang="${next}"]`)?.focus();
              }
            }}
          >
            {(["en", "tr"] as const).map((l) => (
              <button
                key={l}
                type="button"
                role="radio"
                data-lang={l}
                aria-checked={locale === l}
                tabIndex={locale === l ? 0 : -1}
                lang={l}
                onClick={() => setLocale(l)}
              >
                {t(l === "en" ? "lang.en" : "lang.tr")}
              </button>
            ))}
          </div>
          <button
            type="button"
            className="tv-menu-toggle ml-2"
            aria-label={open === "mobile" ? t("nav.menu.close") : t("nav.menu.open")}
            aria-controls="tv-mobile-menu"
            aria-expanded={open === "mobile"}
            onClick={() => setOpen(open === "mobile" ? null : "mobile")}
          >
            {open === "mobile" ? <X /> : <Menu />}
          </button>
        </div>
        {open === "mobile" && (
          <nav id="tv-mobile-menu" className="tv-mobile-menu" aria-label={t("nav.mobile")}>
            {RAIL.map((p) => (
              <Link key={p.href} href={withField(p.href)} onClick={() => setOpen(null)} aria-current={pathname === p.href ? "page" : undefined}>
                {t(p.key)}
              </Link>
            ))}
          </nav>
        )}
      </header>
      <nav className="tv-rail" aria-label={t("nav.sections")}>
        {RAIL.map(({ href, key, icon: Icon, tour }) => (
          <Link key={href} href={withField(href)} data-cosmo-tour={tour} aria-label={t(key)} title={t(key)} aria-current={pathname === href ? "page" : undefined}>
            <Icon aria-hidden />
          </Link>
        ))}
      </nav>
      <nav className="tv-bottom-nav" aria-label={t("nav.quick")}>
        {BOTTOM.map(({ href, key, icon: Icon, tour }) => (
          <Link key={href} href={withField(href)} data-cosmo-tour={tour} aria-label={t(key)} aria-current={pathname === href ? "page" : undefined}>
            <Icon aria-hidden />
            <span>{t(key)}</span>
          </Link>
        ))}
      </nav>
    </>
  );
}
