import type { Metadata } from "next";
import { Suspense } from "react";
import { FieldScreen } from "@/features/field/field-screen";

export const metadata: Metadata = { title: "Field — Travertine" };

export default function FieldPage() {
  return (
    <Suspense>
      <FieldScreen />
    </Suspense>
  );
}
