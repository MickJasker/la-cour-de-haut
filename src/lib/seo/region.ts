/**
 * Localized endonym for the property's region, used in structured data
 * (`addressRegion`) so the language of the markup matches the page's locale.
 * Shared by the LodgingBusiness and POI JSON-LD builders — one place to edit
 * if the region ever changes.
 */
export const REGION_BY_LOCALE: Record<string, string> = {
  nl: "Normandië",
  fr: "Normandie",
  en: "Normandy",
  de: "Normandie",
};

/** Region endonym for a locale, falling back to the French form. */
export function regionForLocale(locale: string): string {
  return REGION_BY_LOCALE[locale] ?? "Normandie";
}
