import type { Metadata } from "next";

/** Canonical public origin. Other domains (www, .com.tr, .site, .online) 308-redirect here at the Vercel edge. */
export const SITE_URL = "https://travertinefields.com";

/** Public routes listed in the sitemap. Routes are added here as they ship. */
export const PUBLIC_ROUTES = ["/", "/app", "/app/explore", "/app/evidence", "/app/data"] as const;

const OG_BASE = { type: "website" as const, siteName: "Travertine", locale: "en_GB", alternateLocale: ["tr_TR"] };

/** Per-page metadata with canonical and Open Graph URLs. Next replaces (not merges) nested openGraph objects. */
export function pageMetadata(title: string, path: string): Metadata & { openGraph: NonNullable<Metadata["openGraph"]> } {
  return { title, alternates: { canonical: path }, openGraph: { ...OG_BASE, title, url: path } };
}
