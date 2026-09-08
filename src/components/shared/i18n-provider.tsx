"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { LOCALE_COOKIE, localeDirection, type Locale } from "@/lib/i18n/config";
import type { Dictionary } from "@/lib/i18n/dictionaries";
import { format } from "@/lib/i18n/dictionaries";

interface I18nContextValue {
  locale: Locale;
  dir: "ltr" | "rtl";
  dict: Dictionary;
  setLocale: (locale: Locale) => void;
  format: typeof format;
}

const I18nContext = React.createContext<I18nContextValue | null>(null);

export function I18nProvider({
  locale,
  dict,
  children,
}: {
  locale: Locale;
  dict: Dictionary;
  children: React.ReactNode;
}) {
  const router = useRouter();

  const setLocale = React.useCallback(
    (next: Locale) => {
      document.cookie = `${LOCALE_COOKIE}=${next}; path=/; max-age=31536000; SameSite=Lax`;
      router.refresh();
    },
    [router]
  );

  const value = React.useMemo<I18nContextValue>(
    () => ({ locale, dir: localeDirection[locale], dict, setLocale, format }),
    [locale, dict, setLocale]
  );

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n() {
  const ctx = React.useContext(I18nContext);
  if (!ctx) throw new Error("useI18n must be used within an I18nProvider");
  return ctx;
}
