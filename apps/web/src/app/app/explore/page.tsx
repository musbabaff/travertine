import type { Metadata } from "next";
import { pageMetadata } from "@/lib/site";
import { Suspense } from "react";
import { ExploreScreen } from "@/features/explore/explore-screen";

export const metadata: Metadata = pageMetadata("Explore rotations — Travertine", "/app/explore");

export default function ExplorePage() {
  return (
    <Suspense>
      <ExploreScreen />
    </Suspense>
  );
}
