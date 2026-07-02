// Shared value/type vocabulary for the translate seam
// (translate.ts / translate-adapter.ts / translate-*-adapter.ts). Kept in its
// own module with no adapter imports so the adapter implementations and the
// factory can both depend on it without forming an import cycle.

export const DISPLAY_LOCALES = ["nl", "en", "fr", "de"] as const;
export type DisplayLocale = (typeof DISPLAY_LOCALES)[number];

export type ReviewTranslationResult = {
  detectedSource: string;
  translations: Partial<Record<DisplayLocale, string>>;
};

export type TranslateTextOptions = {
  sourceLocale?: string;
  mimeType?: "text/plain" | "text/html";
};
