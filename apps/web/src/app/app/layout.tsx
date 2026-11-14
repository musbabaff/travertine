import { Suspense } from "react";
import { AppHeader } from "@/components/shell/app-header";
import { SkipLink } from "@/components/shell/skip-link";

export default function AppLayout({ children }: LayoutProps<"/app">) {
  return (
    <div className="flex min-h-svh flex-col">
      <SkipLink />
      <Suspense fallback={<div className="h-14 border-b border-border bg-surface" />}>
        <AppHeader />
      </Suspense>
      <main className="flex flex-1 flex-col lg:min-h-0">{children}</main>
    </div>
  );
}
