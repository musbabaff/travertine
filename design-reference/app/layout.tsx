import type { Metadata } from "next";
import "./globals.css";
import "./sections.css";
import "./refinements.css";
import "./field-shift.css";
import "./decision-support.css";
import "./cosmo/mascot.css";
import "./cosmo/cosmo.css";
import "./cosmo/intro.css";
import SiteHeader from "./site-header";
import CosmoAssistant from "./cosmo/assistant";
import CosmoIntro from "./cosmo/intro";

export const metadata: Metadata = {
  title: { default: "Travertine | Çiftlik Yönetimi", template: "%s | Travertine" },
  description: "Tarla durumunu izle, ekim nöbeti seçeneklerini ve kanıtlarını incele.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="tr">
      <body><SiteHeader />{children}<CosmoAssistant /><CosmoIntro /></body>
    </html>
  );
}
