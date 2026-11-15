"use client";

import { usePathname } from "next/navigation";
import { useEffect } from "react";
import { useI18n, type MessageKey } from "@/i18n";

const TITLES: [RegExp, MessageKey][] = [
  [/^\/$/, "title.home"],
  [/^\/app\/overview/, "title.overview"],
  [/^\/app\/explore/, "title.explore"],
  [/^\/app\/plan/, "title.plan"],
  [/^\/app\/evidence/, "title.evidence"],
  [/^\/app\/data/, "title.data"],
  [/^\/app\/?$/, "title.field"],
];

/** The tab title follows the language switch. Server metadata stays English for search and link previews. */
export function DocumentTitle() {
  const { t, locale } = useI18n();
  const pathname = usePathname();
  useEffect(() => {
    const key = TITLES.find(([re]) => re.test(pathname))?.[1] ?? "title.notFound";
    const want = t(key);
    // Next.js writes the server title back after navigation and hydration; put ours back whenever it changes.
    const apply = () => {
      if (document.title !== want) document.title = want;
    };
    apply();
    const observer = new MutationObserver(apply);
    observer.observe(document.head, { subtree: true, childList: true, characterData: true });
    return () => observer.disconnect();
  }, [pathname, locale, t]);
  return null;
}
