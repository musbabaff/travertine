"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import {
  Bell,
  ClipboardList,
  ChevronDown,
  CloudSun,
  Droplets,
  Fingerprint,
  Home,
  Layers,
  Menu,
  Package,
  Search,
  Settings,
  Sprout,
  ChartNoAxesCombined,
  X,
  ArrowUpRight,
} from "lucide-react";
import { monitoringPages, analyticsPages, utilityPages, decisionPages } from "./navigation";

const railPages = [
  { href: "/", title: "Genel Bakış", icon: Home },
  { href: "/monitoring", title: "Tarla İzleme", icon: Layers },
  { href: "/weather", title: "Hava Durumu", icon: CloudSun },
  { href: "/production", title: "Üretim", icon: Sprout },
  { href: "/irrigation", title: "Sulama", icon: Droplets },
  { href: "/analytics", title: "Analizler", icon: ChartNoAxesCombined },
  { href: "/harvest", title: "Hasat", icon: Package },
  { href: "/reports", title: "Raporlar", icon: ClipboardList },
  { href: "/notifications", title: "Bildirimler", icon: Bell },
  { href: "/settings", title: "Ayarlar", icon: Settings },
];

export default function SiteHeader() {
  const pathname = usePathname();
  const [menu, setMenu] = useState<string | null>(null);
  const headerRef = useRef<HTMLElement>(null);
  const monitoringActive = monitoringPages.some(
    (page) => page.href === pathname,
  );
  const analyticsActive = analyticsPages.some((page) => page.href === pathname);

  useEffect(() => {
    function dismiss(event: PointerEvent) {
      if (!headerRef.current?.contains(event.target as Node)) setMenu(null);
    }
    function escape(event: KeyboardEvent) {
      if (event.key === "Escape") {
        headerRef.current
          ?.querySelector<HTMLButtonElement>('[aria-expanded="true"]')
          ?.focus();
        setMenu(null);
      }
    }
    document.addEventListener("pointerdown", dismiss);
    document.addEventListener("keydown", escape);
    return () => {
      document.removeEventListener("pointerdown", dismiss);
      document.removeEventListener("keydown", escape);
    };
  }, []);

  function closeMenu() {
    setMenu(null);
  }

  return (
    <>
      <a className="skip-link" href="#page-content">
        İçeriğe geç
      </a>
      <header className="site-header" ref={headerRef}>
        <div className="topbar">
          <Link
            href="/"
            className="brand"
            aria-label="Travertine ana sayfa"
            onClick={closeMenu}
          >
            <Fingerprint />
            <span>Travertine</span>
          </Link>
          <nav className="topnav" aria-label="Ana gezinme">
            <Link
              className={pathname === "/" ? "nav-link selected" : "nav-link"}
              href="/"
              onClick={closeMenu}
              aria-current={pathname === "/" ? "page" : undefined}
            >
              Genel Bakış
            </Link>
            {[
              {
                key: "monitoring",
                label: "İzleme",
                active: monitoringActive,
                pages: monitoringPages,
              },
              {
                key: "analytics",
                label: "Analizler",
                active: analyticsActive,
                pages: analyticsPages,
              },
              {
                key: "decision",
                label: "Ekim Kararı",
                active: decisionPages.some((page) => page.href === pathname),
                pages: decisionPages,
              },
            ].map((group) => (
              <div className="nav-group" key={group.key}>
                <button
                  className={`nav-trigger ${group.active || menu === group.key ? "selected" : ""}`}
                  aria-expanded={menu === group.key}
                  aria-controls={`${group.key}-menu`}
                  onClick={() => setMenu(menu === group.key ? null : group.key)}
                >
                  {group.label}
                  <ChevronDown size={17} />
                </button>
                {menu === group.key && (
                  <div id={`${group.key}-menu`} className="nav-dropdown">
                    <span className="dropdown-label">{group.label}</span>
                    {group.pages.map((page) => (
                      <Link
                        href={page.href}
                        key={page.href}
                        onClick={closeMenu}
                        aria-current={
                          pathname === page.href ? "page" : undefined
                        }
                      >
                        <div>
                          <strong>{page.title}</strong>
                          <small>{page.description}</small>
                        </div>
                        <ArrowUpRight size={17} />
                      </Link>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </nav>
          <div className="account">
            <Link
              className="round"
              href="/search"
              aria-label="Ara"
              onClick={closeMenu}
            >
              <Search />
            </Link>
            <Link
              className="round notification"
              href="/notifications"
              aria-label="Bildirimler"
              onClick={closeMenu}
            >
              <Bell />
              <i />
            </Link>
            <button
              className="round mobile-menu-toggle"
              aria-label={menu === "all" ? "Menüyü kapat" : "Menüyü aç"}
              aria-expanded={menu === "all"}
              aria-controls="mobile-site-menu"
              onClick={() => setMenu(menu === "all" ? null : "all")}
            >
              {menu === "all" ? <X /> : <Menu />}
            </button>
          </div>
        </div>
        {menu === "all" && (
          <nav
            className="mobile-site-menu"
            id="mobile-site-menu"
            aria-label="Tüm sayfalar"
          >
            <Link href="/" onClick={closeMenu}>
              Genel Bakış
            </Link>
            {[
              { label: "İzleme", pages: monitoringPages },
              { label: "Analizler", pages: analyticsPages },
              { label: "Ekim Kararı", pages: decisionPages },
              { label: "Hesap", pages: utilityPages },
            ].map((group) => (
              <section key={group.label}>
                <h2>{group.label}</h2>
                {group.pages.map((page) => (
                  <Link
                    href={page.href}
                    key={page.href}
                    onClick={closeMenu}
                    aria-current={pathname === page.href ? "page" : undefined}
                  >
                    {page.title}
                    <ArrowUpRight size={16} />
                  </Link>
                ))}
              </section>
            ))}
          </nav>
        )}
      </header>
      <nav className="app-rail" aria-label="Bölümler">
        {railPages.map(({ href, title, icon: Icon }) => (
          <Link
            key={href}
            data-cosmo-tour={href === "/monitoring" ? "monitoring" : undefined}
            href={href}
            aria-label={title}
            aria-current={pathname === href || (pathname === "/dashboard" && href === "/") ? "page" : undefined}
            onClick={closeMenu}
          >
            <Icon />
          </Link>
        ))}
      </nav>
      <nav className="mobile-nav" aria-label="Mobil gezinme">
        {[
          {
            href: "/",
            label: "Genel Bakış",
            icon: Home,
            active: pathname === "/",
          },
          {
            href: "/monitoring",
            label: "İzleme",
            icon: Layers,
            active: monitoringActive,
          },
          {
            href: "/analytics",
            label: "Analizler",
            icon: ChartNoAxesCombined,
            active: analyticsActive,
          },
          {
            href: "/settings",
            label: "Ayarlar",
            icon: Settings,
            active: pathname === "/settings",
          },
        ].map(({ href, label, icon: Icon, active }) => (
          <Link
            key={href}
            data-cosmo-tour={href === "/monitoring" ? "monitoring" : undefined}
            href={href}
            aria-current={active ? "page" : undefined}
            onClick={closeMenu}
          >
            <Icon />
            <span>{label}</span>
          </Link>
        ))}
      </nav>
    </>
  );
}
