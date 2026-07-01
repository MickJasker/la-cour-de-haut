"use client";
import { createContext, useContext, useMemo, type ReactNode } from "react";

// Client-side i18n context. The dictionary is seeded once from the Server layout
// (which reads it via the [locale] param), so no Client Component ever touches
// request scope. This mirrors next-intl's useLocale surface to keep call sites
// unchanged.
//
// Deliberately free of any `intl-messageformat` import: this module is pulled
// into the shared client chunk via the root `[locale]/layout.tsx`, so keeping
// the ~34 KiB ICU engine out of it means pages that never format a message on
// the client (the marketing homepage) don't ship it. The formatting hook lives
// in `./use-translations`, imported only by the components that call `t()` on
// the client.
type I18nValue = {
  locale: string;
  messages: Record<string, unknown>;
};

const I18nContext = createContext<I18nValue | null>(null);

export function I18nProvider({
  locale,
  messages,
  children,
}: I18nValue & { children: ReactNode }) {
  const value = useMemo(() => ({ locale, messages }), [locale, messages]);
  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n(): I18nValue {
  const ctx = useContext(I18nContext);
  if (!ctx) {
    throw new Error(
      "useTranslations/useLocale must be used within <I18nProvider>",
    );
  }
  return ctx;
}

export function useLocale(): string {
  return useI18n().locale;
}
