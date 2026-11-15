import { notFound } from "next/navigation";
import { allPages } from "../navigation";
import SectionContent from "../section-content";

export const dynamicParams = false;
export function generateStaticParams() {
  return allPages.map((page) => ({ section: page.href.slice(1) }));
}
export async function generateMetadata({
  params,
}: {
  params: Promise<{ section: string }>;
}) {
  const { section } = await params;
  const page = allPages.find((page) => page.href === `/${section}`);
  return { title: page?.title };
}
export default async function SectionPage({
  params,
}: {
  params: Promise<{ section: string }>;
}) {
  const { section } = await params;
  const page = allPages.find((page) => page.href === `/${section}`);
  if (!page) notFound();
  return (
    <SectionContent
      section={section}
      title={page.title}
      description={page.description}
    />
  );
}
