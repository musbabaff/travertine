"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Bell, ChartNoAxesCombined, ChevronDown, ClipboardList, CloudSun, Droplets, Fingerprint, Home, Layers, Menu, Package, Settings, Sprout, X } from "lucide-react";
import { SourceBadge } from "./source-badge";

const groups = [
  { label: "İzleme", pages: [{ href: "/app", title: "Tarla İzleme", description: "Konum, harita ve tarla sağlığı" }] },
  { label: "Analizler", pages: [
    { href: "/app/explore", title: "Ekim Önerileri", description: "Önceliklerine göre ekim seçenekleri" },
    { href: "/app/evidence", title: "Veri ve Yöntem", description: "Model doğrulaması ve kaynaklar" },
  ] },
] as const;

const rail = [
  { href: "/", title: "Genel Bakış", icon: Home },
  { href: "/app", title: "Tarla İzleme", icon: Layers },
  { href: "/app/explore", title: "Ekim Önerileri", icon: Sprout },
  { href: "/app/evidence", title: "Veri ve Yöntem", icon: ChartNoAxesCombined },
] as const;

const desktopRail = [
  { href: "/", title: "Genel Bakış", icon: Home },
  { href: "/app", title: "Tarla İzleme", icon: Layers },
  { href: null, title: "Hava Durumu", icon: CloudSun },
  { href: null, title: "Üretim", icon: Sprout },
  { href: null, title: "Sulama", icon: Droplets },
  { href: "/app/explore", title: "Ekim Önerileri", icon: ChartNoAxesCombined },
  { href: null, title: "Hasat", icon: Package },
  { href: "/app/evidence", title: "Veri ve Yöntem", icon: ClipboardList },
  { href: null, title: "Bildirimler", icon: Bell },
  { href: null, title: "Ayarlar", icon: Settings },
] as const;

export function AppHeader() {
  const pathname = usePathname();
  const params = useSearchParams();
  const [open, setOpen] = useState<string | null>(null);
  const header = useRef<HTMLElement>(null);
  const query = params.toString();
  const hrefWithField = (href: string) => href === "/" || !query ? href : `${href}?${query}`;

  useEffect(() => {
    const dismiss = (event: PointerEvent) => {
      if (!header.current?.contains(event.target as Node)) setOpen(null);
    };
    const escape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(null);
    };
    document.addEventListener("pointerdown", dismiss);
    document.addEventListener("keydown", escape);
    return () => {
      document.removeEventListener("pointerdown", dismiss);
      document.removeEventListener("keydown", escape);
    };
  }, []);

  return (
    <>
      <a className="tv-skip" href="#main">İçeriğe geç</a>
      <header className="tv-header" ref={header}>
        <Link href="/" className="tv-brand" aria-label="Travertine ana sayfa" onClick={() => setOpen(null)}>
          <Fingerprint aria-hidden="true" />
          <span>Travertine</span>
        </Link>
        <nav className="tv-topnav" aria-label="Ana gezinme">
          <Link className={`tv-pill${pathname === "/" ? " is-active" : ""}`} href="/" aria-current={pathname === "/" ? "page" : undefined}>Genel Bakış</Link>
          {groups.map((group) => (
            <div className="tv-nav-group" key={group.label}>
              <button type="button" className={`tv-pill${group.pages.some((page) => page.href === pathname) ? " is-active" : ""}`} aria-expanded={open === group.label} aria-controls={`tv-menu-${group.label}`} onClick={() => setOpen(open === group.label ? null : group.label)}>
                {group.label}<ChevronDown aria-hidden="true" size={17} />
              </button>
              {open === group.label && (
                <div id={`tv-menu-${group.label}`} className="tv-dropdown">
                  <span className="tv-dropdown-label">{group.label}</span>
                  {group.pages.map((page) => (
                    <Link key={page.href} href={hrefWithField(page.href)} onClick={() => setOpen(null)} aria-current={pathname === page.href ? "page" : undefined}>
                      <strong>{page.title}</strong><small>{page.description}</small>
                    </Link>
                  ))}
                </div>
              )}
            </div>
          ))}
        </nav>
        <div className="tv-header-actions">
          <SourceBadge />
          <button type="button" className="tv-menu-toggle" aria-label={open === "mobile" ? "Menüyü kapat" : "Menüyü aç"} aria-controls="tv-mobile-menu" aria-expanded={open === "mobile"} onClick={() => setOpen(open === "mobile" ? null : "mobile")}>{open === "mobile" ? <X /> : <Menu />}</button>
        </div>
        {open === "mobile" && (
          <nav id="tv-mobile-menu" className="tv-mobile-menu" aria-label="Mobil gezinme">
            {rail.map((item) => <Link key={item.href} href={hrefWithField(item.href)} onClick={() => setOpen(null)} aria-current={pathname === item.href ? "page" : undefined}>{item.title}</Link>)}
          </nav>
        )}
      </header>
      <nav className="tv-rail" aria-label="Bölümler">
        {desktopRail.map(({ href, title, icon: Icon }) => href ? (
          <Link key={title} href={hrefWithField(href)} data-cosmo-tour={href === "/app" ? "field-nav" : href === "/app/evidence" ? "evidence-nav" : undefined} aria-label={title} title={title} aria-current={pathname === href ? "page" : undefined}><Icon aria-hidden="true" /></Link>
        ) : (
          <span key={title} className="tv-rail-pending" role="img" aria-label={`${title}, henüz kullanılamıyor`} title={`${title} · hazırlanıyor`}><Icon aria-hidden="true" /></span>
        ))}
      </nav>
      <nav className="tv-bottom-nav" aria-label="Hızlı gezinme">
        {rail.map(({ href, title, icon: Icon }) => <Link key={href} href={hrefWithField(href)} data-cosmo-tour={href === "/app" ? "field-nav" : href === "/app/evidence" ? "evidence-nav" : undefined} aria-label={title} aria-current={pathname === href ? "page" : undefined}><Icon aria-hidden="true" /><span>{title}</span></Link>)}
      </nav>
    </>
  );
}
