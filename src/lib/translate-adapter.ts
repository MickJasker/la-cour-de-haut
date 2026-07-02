import { googleTranslateAdapter } from "./translate-google-adapter";
import { stubTranslateAdapter } from "./translate-stub-adapter";
import type {
  ReviewTranslationResult,
  TranslateTextOptions,
} from "./translate-types";

/**
 * The seam between "content needs translating" (translateReviewBody /
 * translateText in src/lib/translate.ts) and "how a translation actually
 * gets produced." Both the real Google Cloud Translation adapter and the
 * deterministic E2E stub satisfy this interface, so either is unit-testable
 * on its own without going through getTranslateAdapter().
 */
export interface TranslateAdapter {
  translateReviewBody(
    text: string,
    sourceLocale: string,
  ): Promise<ReviewTranslationResult>;
  translateText(
    text: string,
    target: "en" | "fr" | "de",
    opts?: TranslateTextOptions,
  ): Promise<string>;
}

/**
 * The single E2E_TESTING resolution point for the translate seam — the only
 * place this module checks the env var. Re-evaluated on every call (not
 * memoized) so tests can flip process.env.E2E_TESTING at runtime without
 * re-importing the module, matching the existing test pattern in
 * translate.test.ts / localized-field.test.ts / localized-detail.test.ts.
 */
export function getTranslateAdapter(): TranslateAdapter {
  return process.env.E2E_TESTING
    ? stubTranslateAdapter
    : googleTranslateAdapter;
}
