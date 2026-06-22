export const locales = ["nl", "en", "fr", "de"] as const;
export const defaultLocale = "nl" as const;

export type Locale = (typeof locales)[number];

export function hasLocale(value: string | undefined | null): value is Locale {
  return value != null && (locales as readonly string[]).includes(value);
}
