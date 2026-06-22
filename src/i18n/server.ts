import "server-only";
import { getDictionary } from "./dictionaries";
import { createTranslator, type Translator } from "./translate";
import type { Locale } from "./routing";

// Server-side equivalent of next-intl's getTranslations. Locale must be passed in
// explicitly (resolved from the [locale] route param), never from request scope —
// that is what keeps consumers prerenderable / cacheComponents-compatible.
export async function getTranslations({
  locale,
  namespace,
}: {
  locale: Locale;
  namespace?: string;
}): Promise<Translator> {
  const messages = await getDictionary(locale);
  return createTranslator(locale, messages, namespace);
}
