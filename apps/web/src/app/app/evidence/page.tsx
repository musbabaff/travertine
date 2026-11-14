import type { Metadata } from "next";
import { Suspense } from "react";
import { EvidenceScreen } from "@/features/evidence/evidence-screen";

export const metadata: Metadata = { title: "Evidence — Travertine" };

export default function EvidencePage() {
  return (
    <Suspense>
      <EvidenceScreen />
    </Suspense>
  );
}
