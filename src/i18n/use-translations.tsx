"use client";
import { useMemo } from "react";
import { useI18n } from "./provider";
import { createTranslator, type Translator } from "./translate";

// Client-side message formatting. Kept in its own module (separate from the
// I18nProvider context) so that `intl-messageformat` — pulled in transitively by
// `createTranslator` — is only bundled into pages that actually format messages
// on the client. The context/provider itself, which every route loads via the
// root layout, stays free of the ICU engine. See `./provider`.
export function useTranslations(namespace?: string): Translator {
  const { locale, messages } = useI18n();
  return useMemo(
    () => createTranslator(locale, messages, namespace),
    [locale, messages, namespace],
  );
}
