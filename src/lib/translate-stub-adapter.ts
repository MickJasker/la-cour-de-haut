import type { TranslateAdapter } from "./translate-adapter";
import {
  DISPLAY_LOCALES,
  type ReviewTranslationResult,
} from "./translate-types";

/**
 * Deterministic stand-in for Google Cloud Translation, used under
 * E2E_TESTING (resolved by getTranslateAdapter() in ./translate-adapter).
 * Appends "[locale]" to the source text instead of calling out to Google, so
 * Playwright runs stay offline and their assertions on translated text are
 * deterministic. See CONTEXT.md "Media storage" for the matching
 * blob-upload stub.
 */
async function translateReviewBody(
  text: string,
  sourceLocale: string,
): Promise<ReviewTranslationResult> {
  const detectedSource = sourceLocale === "und" ? "en" : sourceLocale;
  const translations: ReviewTranslationResult["translations"] = {};
  for (const l of DISPLAY_LOCALES.filter((x) => x !== detectedSource)) {
    translations[l] = `${text} [${l}]`;
  }
  return { detectedSource, translations };
}

async function translateText(
  text: string,
  target: "en" | "fr" | "de",
): Promise<string> {
  return `${text} [${target}]`;
}

export const stubTranslateAdapter: TranslateAdapter = {
  translateReviewBody,
  translateText,
};
