import type { TranslateAdapter } from "./translate-adapter";
import {
  DISPLAY_LOCALES,
  type ReviewTranslationResult,
  type TranslateTextOptions,
} from "./translate-types";

function isFulfilled<V>(
  result: PromiseSettledResult<V>,
): result is PromiseFulfilledResult<V> {
  return result.status === "fulfilled";
}

/**
 * Builds a Google Cloud Translation v3 client from the credentials JSON env
 * var, plus the `parent` resource path every request needs. Shared by both
 * the authored-content and quoted-content translate paths.
 */
async function getTranslationClient() {
  const credsJson = process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON;
  if (!credsJson) {
    throw new Error(
      "GOOGLE_APPLICATION_CREDENTIALS_JSON environment variable is not set",
    );
  }

  const creds = JSON.parse(credsJson) as {
    project_id: string;
    client_email: string;
    private_key: string;
  };

  const { v3 } = await import("@google-cloud/translate");
  const { TranslationServiceClient } = v3;

  const client = new TranslationServiceClient({
    credentials: {
      client_email: creds.client_email,
      private_key: creds.private_key,
    },
    projectId: creds.project_id,
  });

  return { client, parent: `projects/${creds.project_id}/locations/global` };
}

/**
 * Source-aware translation for quoted content (reviews). Unlike
 * `translateText` (authored content, always Dutch→target), this translates
 * outward from an arbitrary original locale and never produces a machine
 * self-translation of the source slot. See ADR-0014.
 */
async function translateReviewBody(
  text: string,
  sourceLocale: string,
): Promise<ReviewTranslationResult> {
  const isAutoDetect = sourceLocale === "und";
  const targets = isAutoDetect
    ? [...DISPLAY_LOCALES]
    : DISPLAY_LOCALES.filter((l) => l !== sourceLocale);

  const { client, parent } = await getTranslationClient();

  // allSettled so a single locale's Google failure does not lose the others —
  // the owner must not lose ALL review translations because one locale call
  // rejected (see ADR-0016 "failures degrade, never block").
  const results = await Promise.allSettled(
    targets.map((targetLanguageCode) =>
      client.translateText({
        contents: [text],
        ...(isAutoDetect ? {} : { sourceLanguageCode: sourceLocale }),
        targetLanguageCode,
        mimeType: "text/plain",
        parent,
      }),
    ),
  );

  const firstFulfilled = results.find(isFulfilled);

  let detectedSource = sourceLocale;
  if (isAutoDetect) {
    if (!firstFulfilled) {
      throw new Error(
        "Google Translate failed for every target locale; cannot detect source language",
      );
    }
    const raw =
      firstFulfilled.value[0].translations?.[0]?.detectedLanguageCode ?? "und";
    detectedSource = raw.split("-")[0].toLowerCase();
  }

  const translations: ReviewTranslationResult["translations"] = {};
  targets.forEach((locale, i) => {
    // When auto-detection resolves to one of the four, that slot is the source
    // (seeded verbatim from original_body) — never a machine self-translation.
    if (isAutoDetect && locale === detectedSource) return;
    const result = results[i];
    if (result.status === "rejected") return;
    const translated = result.value[0].translations?.[0]?.translatedText;
    if (!translated) return;
    translations[locale] = translated;
  });

  return { detectedSource, translations };
}

/**
 * Translates a single string into one target locale. Used by the auto-translate
 * save actions (ADR-0016) which need per-locale control (allSettled fan-out,
 * gap-fill, failure isolation) — callers compose the fan-out themselves by
 * calling this once per target locale.
 */
async function translateText(
  text: string,
  target: "en" | "fr" | "de",
  opts?: TranslateTextOptions,
): Promise<string> {
  const sourceLocale = opts?.sourceLocale ?? "nl";
  const mimeType = opts?.mimeType ?? "text/plain";

  const { client, parent } = await getTranslationClient();

  const result = await client.translateText({
    contents: [text],
    sourceLanguageCode: sourceLocale,
    targetLanguageCode: target,
    mimeType,
    parent,
  });

  const translated = result[0].translations?.[0]?.translatedText;
  if (!translated) {
    throw new Error("Google Translate returned an empty translation response");
  }

  return translated;
}

/** Real adapter: calls out to Google Cloud Translation v3. */
export const googleTranslateAdapter: TranslateAdapter = {
  translateReviewBody,
  translateText,
};
