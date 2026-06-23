"use client";
import { createContext, useContext, useMemo, type ReactNode } from "react";
import { createTranslator, type Translator } from "./translate";

// Client-side i18n. The dictionary is seeded once from the Server layout (which
// reads it via the [locale] param), so no Client Component ever touches request
// scope. This mirrors next-intl's useTranslations/useLocale surface to keep call
// sites unchanged.
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

function useI18n(): I18nValue {
  const ctx = useContext(I18nContext);
  if (!ctx) {
    throw new Error(
      "useTranslations/useLocale must be used within <I18nProvider>",
    );
  }
  return ctx;
}

export function useTranslations(namespace?: string): Translator {
  const { locale, messages } = useI18n();
  return useMemo(
    () => createTranslator(locale, messages, namespace),
    [locale, messages, namespace],
  );
}

export function useLocale(): string {
  return useI18n().locale;
}
