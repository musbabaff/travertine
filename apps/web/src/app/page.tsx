import { Suspense } from "react";
import { DashboardScreen } from "@/features/dashboard/dashboard-screen";
import { SiteFooter } from "@/components/shell/site-footer";

export default function Home() {
  return (
    <>
      <Suspense fallback={<main id="main" className="tv-dashboard"><div className="tv-dashboard-loading" /></main>}>
        <DashboardScreen />
      </Suspense>
      <SiteFooter />
    </>
  );
}
