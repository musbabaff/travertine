"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useI18n } from "@/i18n";
import type { Crop } from "@/lib/api/types";

/** Current rotation, one crop id per year, kept in the URL as `cur=a,b,c` so the comparison can be shared. */
export function parseCurrent(params: URLSearchParams): string[] {
  return (params.get("cur") ?? "").split(",").map((s) => s.trim()).filter(Boolean).slice(0, 5);
}

export function CurrentRotationPicker({ crops, horizon }: { crops: Crop[] | undefined; horizon: number }) {
  const { t } = useI18n();
  const params = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const current = parseCurrent(new URLSearchParams(params.toString()));

  const write = (next: string[]) => {
    const p = new URLSearchParams(window.location.search);
    const trimmed = [...next];
    while (trimmed.length && !trimmed[trimmed.length - 1]) trimmed.pop();
    if (trimmed.length && trimmed.every(Boolean)) p.set("cur", trimmed.join(","));
    else p.delete("cur");
    router.replace(`${pathname}?${p.toString()}`, { scroll: false });
  };
  const setYear = (i: number, id: string) => {
    const next = Array.from({ length: horizon }, (_, k) => current[k] ?? "");
    next[i] = id;
    write(next);
  };

  return (
    <section aria-labelledby="current-title" className="tv-card rounded-md border border-border bg-surface p-4 shadow-1 md:p-5" data-testid="current-rotation">
      <h2 id="current-title" className="text-h3 font-semibold">
        {t("current.title")}
      </h2>
      <p className="mt-0.5 text-xs text-ink-muted">{t("current.hint")}</p>
      <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-[repeat(var(--n),minmax(0,1fr))]" style={{ "--n": horizon } as React.CSSProperties}>
        {Array.from({ length: horizon }, (_, i) => (
          <label key={i} className="block text-xs text-ink-2">
            {t("explore.year", { n: i + 1 })}
            <select
              className="mt-1 block h-10 w-full rounded-md border border-border-strong bg-surface px-2 text-sm text-ink"
              value={current[i] ?? ""}
              onChange={(e) => setYear(i, e.target.value)}
              disabled={!crops}
            >
              <option value="">{t("current.none")}</option>
              {crops?.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </label>
        ))}
      </div>
      {current.length > 0 && (
        <button type="button" onClick={() => write([])} className="mt-3 min-h-9 rounded-md px-2 text-xs font-medium text-teal-700 hover:bg-teal-100">
          {t("current.clear")}
        </button>
      )}
    </section>
  );
}
