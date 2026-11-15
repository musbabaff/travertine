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
  title: "Travertine — crop-rotation decisions from Earth observation data",
  alternates: { canonical: "/" },
  // Lets CI confirm which commit production serves (see .github/workflows/deploy-check.yml).
  other: { "travertine-commit": process.env.VERCEL_GIT_COMMIT_SHA ?? "local" },
  openGraph: pageMetadata("Travertine — crop-rotation decisions from Earth observation data", "/").openGraph,
  description:
    "Mark a field, set your priorities and explore three- to five-year crop rotations scored with open satellite and climate records.",
};

export const viewport: Viewport = { themeColor: "#faf7f2" };

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${plex.variable} h-full antialiased`}>
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
