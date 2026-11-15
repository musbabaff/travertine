import type { Metadata } from "next";
import { Suspense } from "react";
import { DashboardScreen } from "@/features/dashboard/dashboard-screen";
import { pageMetadata } from "@/lib/site";

export const metadata: Metadata = pageMetadata("Field overview — Travertine", "/app/overview");

export default function OverviewPage() {
  return (
    <Suspense fallback={<main id="main" className="tv-dashboard"><div className="tv-dashboard-loading" /></main>}>
      <DashboardScreen />
    </Suspense>
  );
}
