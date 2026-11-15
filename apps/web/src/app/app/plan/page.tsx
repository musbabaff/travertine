import type { Metadata } from "next";
import { Suspense } from "react";
import { PlanScreen } from "@/features/plan/plan-screen";
import { pageMetadata } from "@/lib/site";

export const metadata: Metadata = pageMetadata("Rotation plan — Travertine", "/app/plan");

export default function PlanPage() {
  return (
    <Suspense>
      <PlanScreen />
    </Suspense>
  );
}
