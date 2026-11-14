import type { Metadata } from "next";
import { Suspense } from "react";
import { DataScreen } from "@/features/data/data-screen";
import { pageMetadata } from "@/lib/site";

export const metadata: Metadata = pageMetadata("Data sources — Travertine", "/app/data");

export default function DataPage() {
  return (
    <Suspense>
      <DataScreen />
    </Suspense>
  );
}
