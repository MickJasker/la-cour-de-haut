import { getTranslateAdapter } from "./translate-adapter";
import type {
  ReviewTranslationResult,
  TranslateTextOptions,
} from "./translate-types";

export type { ReviewTranslationResult };

/**
 * Source-aware translation for quoted content (reviews). Unlike
 * `translateText` (authored content, always Dutch→target), this translates
 * outward from an arbitrary original locale and never produces a machine
 * self-translation of the source slot. See ADR-0014.
 *
 * Adapter-blind: delegates to whichever adapter getTranslateAdapter()
 * resolves (real Google Cloud Translation, or the deterministic E2E stub —
 * see ./translate-adapter). This module never branches on E2E_TESTING.
 */
export async function translateReviewBody(
  text: string,
  sourceLocale: string,
): Promise<ReviewTranslationResult> {
  return getTranslateAdapter().translateReviewBody(text, sourceLocale);
}

/**
 * Translates a single string into one target locale. Used by the auto-translate
 * save actions (ADR-0016) which need per-locale control (allSettled fan-out,
 * gap-fill, failure isolation) — callers compose the fan-out themselves by
 * calling this once per target locale.
 *
 * Adapter-blind: see translateReviewBody above.
 */
export async function translateText(
  text: string,
  target: "en" | "fr" | "de",
  opts?: TranslateTextOptions,
): Promise<string> {
  return getTranslateAdapter().translateText(text, target, opts);
}
