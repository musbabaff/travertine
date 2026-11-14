"use client";

import { Loader2, MapPin, Search } from "lucide-react";
import { useEffect, useId, useRef, useState } from "react";
import { useI18n } from "@/i18n";
import { parseCoordinates, type LngLat } from "@/lib/geo";

interface Place {
  id: string;
  name: string;
  detail: string;
  center: LngLat;
  bbox?: [number, number, number, number];
}

type Status = "idle" | "loading" | "done" | "error";

async function searchPhoton(q: string, lang: string, signal: AbortSignal): Promise<Place[]> {
  const url = `https://photon.komoot.io/api/?q=${encodeURIComponent(q)}&limit=6&lang=${lang === "tr" ? "default" : "en"}`;
  const res = await fetch(url, { signal });
  if (!res.ok) throw new Error(String(res.status));
  const json = (await res.json()) as { features: { geometry: { coordinates: LngLat }; properties: Record<string, string | number[] | undefined> }[] };
  return json.features.map((f, i) => {
    const p = f.properties;
    const detail = [p.county, p.state, p.country].filter((x) => typeof x === "string" && x !== p.name).join(", ");
    const ext = p.extent as number[] | undefined;
    return { id: `${p.osm_type}${p.osm_id}-${i}`, name: String(p.name ?? detail), detail, center: f.geometry.coordinates, bbox: ext ? [ext[0], ext[3], ext[2], ext[1]] : undefined };
  });
}

export function PlaceSearch({ onSelect }: { onSelect: (center: LngLat, bbox?: [number, number, number, number]) => void }) {
  const { t, locale } = useI18n();
  const id = useId();
  const [q, setQ] = useState("");
  const [results, setResults] = useState<Place[]>([]);
  const [rawStatus, setStatus] = useState<Status>("idle");
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const root = useRef<HTMLDivElement>(null);

  const coords = parseCoordinates(q);
  const searching = !coords && q.trim().length >= 3;
  const status: Status = searching ? rawStatus : "idle";
  const options: Place[] = coords
    ? [{ id: "coords", name: t("field.search.coords", { lat: coords.lat, lon: coords.lon }), detail: "", center: [coords.lon, coords.lat] }]
    : searching ? results : [];

  useEffect(() => {
    const query = q.trim();
    if (coords || query.length < 3) return;
    const ctrl = new AbortController();
    const timer = setTimeout(async () => {
      setStatus("loading");
      try {
        setResults(await searchPhoton(query, locale, ctrl.signal));
        setStatus("done");
      } catch {
        if (!ctrl.signal.aborted) setStatus("error");
      }
    }, 350);
    return () => {
      clearTimeout(timer);
      ctrl.abort();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- coords is derived from q
  }, [q, locale]);

  useEffect(() => {
    const onDown = (e: PointerEvent) => !root.current?.contains(e.target as Node) && setOpen(false);
    document.addEventListener("pointerdown", onDown);
    return () => document.removeEventListener("pointerdown", onDown);
  }, []);

  const choose = (p: Place) => {
    onSelect(p.center, p.bbox);
    setQ(p.id === "coords" ? q : p.name);
    setOpen(false);
    setActive(-1);
  };

  const showList = open && (options.length > 0 || status === "loading" || status === "error" || (status === "done" && !coords));

  return (
    <div ref={root} className="relative">
      <label htmlFor={id} className="mb-1.5 block text-xs font-medium text-ink-2">
        {t("field.search.label")}
      </label>
      <div className="relative">
        <Search aria-hidden className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-ink-muted" strokeWidth={1.5} />
        <input
          id={id}
          type="search"
          role="combobox"
          aria-expanded={!!showList}
          aria-controls={`${id}-list`}
          aria-autocomplete="list"
          aria-activedescendant={active >= 0 ? `${id}-opt-${active}` : undefined}
          autoComplete="off"
          spellCheck={false}
          value={q}
          placeholder={t("field.search.placeholder")}
          onChange={(e) => {
            setQ(e.target.value);
            setOpen(true);
            setActive(-1);
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={(e) => {
            if (e.key === "ArrowDown") {
              e.preventDefault();
              setOpen(true);
              setActive((a) => Math.min(a + 1, options.length - 1));
            } else if (e.key === "ArrowUp") {
              e.preventDefault();
              setActive((a) => Math.max(a - 1, 0));
            } else if (e.key === "Enter") {
              const pick = options[active >= 0 ? active : 0];
              if (pick) {
                e.preventDefault();
                choose(pick);
              }
            } else if (e.key === "Escape") setOpen(false);
          }}
          className="h-11 w-full rounded-md border border-border-strong bg-surface pl-9 pr-9 text-body text-ink placeholder:text-ink-muted md:h-10 md:text-sm"
        />
        {status === "loading" && <Loader2 aria-hidden className="absolute right-3 top-1/2 size-4 -translate-y-1/2 animate-spin text-ink-muted" strokeWidth={1.5} />}
      </div>
      {showList && (
        <div className="absolute inset-x-0 top-full z-30 mt-1 overflow-hidden rounded-md border border-border bg-surface shadow-3">
          <ul id={`${id}-list`} role="listbox" aria-label={t("field.search.label")} className="max-h-72 overflow-y-auto py-1">
            {options.map((p, i) => (
              <li
                key={p.id}
                id={`${id}-opt-${i}`}
                role="option"
                aria-selected={i === active}
                onPointerDown={(e) => e.preventDefault()}
                onClick={() => choose(p)}
                className={`flex cursor-pointer items-start gap-2 px-3 py-2 ${i === active ? "bg-teal-100" : "hover:bg-sunken"}`}
              >
                <MapPin aria-hidden className="mt-0.5 size-4 shrink-0 text-ink-muted" strokeWidth={1.5} />
                <span className="min-w-0">
                  <span className="block truncate text-sm text-ink">{p.name}</span>
                  {p.detail && <span className="block truncate text-xs text-ink-muted">{p.detail}</span>}
                </span>
              </li>
            ))}
          </ul>
          <p aria-live="polite" className="px-3 pb-2 pt-1 text-xs text-ink-muted">
            {status === "loading" && options.length === 0 && t("field.search.loading")}
            {status === "error" && t("field.search.error")}
            {status === "done" && !coords && options.length === 0 && t("field.search.none")}
            {options.length > 0 && !coords && t("field.search.attribution")}
          </p>
        </div>
      )}
    </div>
  );
}
