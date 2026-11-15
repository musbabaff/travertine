import type { Metadata, Viewport } from "next";
import { IBM_Plex_Sans } from "next/font/google";
import "maplibre-gl/dist/maplibre-gl.css";
import "./globals.css";
import "@/components/cosmo/mascot.css";
import "@/components/cosmo/cosmo.css";
import "@/components/cosmo/intro.css";
import "./travertine-ui.css";
import { pageMetadata, SITE_URL } from "@/lib/site";
import { Providers } from "./providers";
import { AppHeader } from "@/components/shell/app-header";
import CosmoAssistant from "@/components/cosmo/assistant";
import CosmoIntro from "@/components/cosmo/intro";
import { Suspense } from "react";

const plex = IBM_Plex_Sans({
  variable: "--font-plex",
  subsets: ["latin", "latin-ext"],
  weight: ["400", "500", "600"],
});

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: "Travertine — Tarla ve ekim kararları",
  alternates: { canonical: "/" },
  // Lets CI confirm which commit production serves (see .github/workflows/deploy-check.yml).
  other: { "travertine-commit": process.env.VERCEL_GIT_COMMIT_SHA ?? "local" },
  openGraph: pageMetadata("Travertine — Tarla ve ekim kararları", "/").openGraph,
  description:
    "Tarlanı incele, önceliklerini belirle ve uydu ile iklim verilerine dayalı ekim seçeneklerini karşılaştır.",
};

export const viewport: Viewport = { themeColor: "#faf7f2" };

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="tr" className={`${plex.variable} h-full antialiased`}>
      <body className="min-h-full">
        <Providers>
          <Suspense fallback={null}><AppHeader /></Suspense>
          <div className="tv-content">{children}</div>
          <Suspense fallback={null}><CosmoAssistant /></Suspense>
          <CosmoIntro />
        </Providers>
      </body>
    </html>
  );
}
