"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import en from "./en.json";
import tr from "./tr.json";

export const dictionaries = { en, tr } as const;
export type Locale = keyof typeof dictionaries;
export type MessageKey = keyof typeof en;
export type Vars = Record<string, string | number>;

const STORAGE_KEY = "travertine.locale";

export function format(locale: Locale, key: MessageKey, vars?: Vars): string {
  const template: string = (dictionaries[locale] as Record<string, string>)[key] ?? en[key] ?? key;
  return vars ? template.replace(/\{(\w+)\}/g, (_, k: string) => String(vars[k] ?? `{${k}}`)) : template;
}

interface I18nValue {
  locale: Locale;
  setLocale: (l: Locale) => void;
  t: (key: MessageKey, vars?: Vars) => string;
  /** Locale-aware number formatting. */
  n: (value: number, digits?: number) => string;
}

const I18nContext = createContext<I18nValue | null>(null);

export function I18nProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>("en");

  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      // eslint-disable-next-line react-hooks/set-state-in-effect -- hydrate the saved preference after SSR
      if (saved === "en" || saved === "tr") setLocaleState(saved);
    } catch {
      /* storage unavailable */
    }
  }, []);

  useEffect(() => {
    document.documentElement.lang = locale;
  }, [locale]);

  const setLocale = useCallback((l: Locale) => {
    setLocaleState(l);
    try {
      localStorage.setItem(STORAGE_KEY, l);
    } catch {
      /* storage unavailable */
    }
  }, []);

  const value = useMemo<I18nValue>(() => {
    const nf = new Map<number, Intl.NumberFormat>();
    const tag = locale === "tr" ? "tr-TR" : "en-GB";
    return {
      locale,
      setLocale,
      t: (key, vars) => format(locale, key, vars),
      n: (v, digits = 0) => {
        if (!nf.has(digits)) nf.set(digits, new Intl.NumberFormat(tag, { minimumFractionDigits: digits, maximumFractionDigits: digits }));
        return nf.get(digits)!.format(v);
      },
    };
  }, [locale, setLocale]);

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n(): I18nValue {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error("useI18n must be used inside I18nProvider");
  return ctx;
}
