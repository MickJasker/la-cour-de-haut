import "server-only";
import type { Locale } from "./routing";
import { nl, enGB, fr, de } from "date-fns/locale";

// Lazy per-locale imports so only the requested dictionary is loaded. Keying off
// the (statically-known) [locale] route param keeps this prerenderable, which is
// what makes the i18n layer compatible with `cacheComponents` — see ADR 0008.
// JSON modules expose the object as the default export at runtime; the cast keeps
// TS happy across module settings without changing behaviour.
const load = <T>(p: Promise<T>) =>
  p.then((m) => (m as { default: Messages }).default);

const dictionaries = {
  nl: () => load(import("../../messages/nl.json")),
  en: () => load(import("../../messages/en.json")),
  fr: () => load(import("../../messages/fr.json")),
  de: () => load(import("../../messages/de.json")),
} satisfies Record<Locale, () => Promise<Messages>>;

export type Messages = typeof import("../../messages/nl.json");

export const getDictionary = (locale: Locale): Promise<Messages> =>
  dictionaries[locale]();

export function getDateFnsLocale(locale: Locale) {
  switch (locale) {
    case "nl":
      return nl;
    case "fr":
      return fr;
    case "en":
      return enGB;
    case "de":
      return de;
    default:
      return nl;
  }
}
