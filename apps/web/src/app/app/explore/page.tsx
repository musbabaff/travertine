import type { Metadata } from "next";
import { Suspense } from "react";
import { ExploreScreen } from "@/features/explore/explore-screen";

export const metadata: Metadata = { title: "Explore rotations — Travertine" };

export default function ExplorePage() {
  return (
    <Suspense>
      <ExploreScreen />
    </Suspense>
  );
}
