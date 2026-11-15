import { SiteFooter } from "@/components/shell/site-footer";

export default function AppLayout({ children }: LayoutProps<"/app">) {
  return (
    <div className="flex min-h-svh flex-col">
      <main className="flex flex-1 flex-col lg:min-h-0">{children}</main>
      <SiteFooter />
    </div>
  );
}
