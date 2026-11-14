import type { Metadata } from "next";
import { pageMetadata } from "@/lib/site";
import { Suspense } from "react";
import { FieldScreen } from "@/features/field/field-screen";

export const metadata: Metadata = pageMetadata("Field — Travertine", "/app");

export default function FieldPage() {
  return (
    <Suspense>
      <FieldScreen />
    </Suspense>
  );
}
