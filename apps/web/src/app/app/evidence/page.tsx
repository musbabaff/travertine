import type { Metadata } from "next";
import { pageMetadata } from "@/lib/site";
import { Suspense } from "react";
import { EvidenceScreen } from "@/features/evidence/evidence-screen";

export const metadata: Metadata = pageMetadata("Evidence — Travertine", "/app/evidence");

export default function EvidencePage() {
  return (
    <Suspense>
      <EvidenceScreen />
    </Suspense>
  );
}
