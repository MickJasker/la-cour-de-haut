const DISPLAY_LOCALES = ["nl", "en", "fr", "de"] as const;
type DisplayLocale = (typeof DISPLAY_LOCALES)[number];

export type ReviewTranslationResult = {
  detectedSource: string;
  translations: Partial<Record<DisplayLocale, string>>;
};

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
 * `translateToAllLocales` (authored content, always Dutch→EN/FR/DE), this
 * translates outward from an arbitrary original locale and never produces a
 * machine self-translation of the source slot. See ADR-0014.
 */
export async function translateReviewBody(
  text: string,
  sourceLocale: string,
): Promise<ReviewTranslationResult> {
  if (process.env.E2E_TESTING) {
    const detectedSource = sourceLocale === "und" ? "en" : sourceLocale;
    const translations: Partial<Record<DisplayLocale, string>> = {};
    for (const l of DISPLAY_LOCALES.filter((x) => x !== detectedSource)) {
      translations[l] = `${text} [${l}]`;
    }
    return { detectedSource, translations };
  }

  const isAutoDetect = sourceLocale === "und";
  const targets = isAutoDetect
    ? [...DISPLAY_LOCALES]
    : DISPLAY_LOCALES.filter((l) => l !== sourceLocale);

  const { client, parent } = await getTranslationClient();

  const results = await Promise.all(
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

  let detectedSource = sourceLocale;
  if (isAutoDetect) {
    const raw =
      results[0]?.[0].translations?.[0]?.detectedLanguageCode ?? "und";
    detectedSource = raw.split("-")[0].toLowerCase();
  }

  const translations: Partial<Record<DisplayLocale, string>> = {};
  targets.forEach((locale, i) => {
    // When auto-detection resolves to one of the four, that slot is the source
    // (seeded verbatim from original_body) — never a machine self-translation.
    if (isAutoDetect && locale === detectedSource) return;
    const translated = results[i][0].translations?.[0]?.translatedText;
    if (!translated) {
      throw new Error(
        "Google Translate returned an empty translation response",
      );
    }
    translations[locale] = translated;
  });

  return { detectedSource, translations };
}

export async function translateToAllLocales(
  text: string,
  sourceLocale = "nl",
): Promise<{ en: string; fr: string; de: string }> {
  if (process.env.E2E_TESTING) {
    return { en: `${text} [en]`, fr: `${text} [fr]`, de: `${text} [de]` };
  }

  const { client, parent } = await getTranslationClient();

  const [enResult, frResult, deResult] = await Promise.all([
    client.translateText({
      contents: [text],
      sourceLanguageCode: sourceLocale,
      targetLanguageCode: "en",
      mimeType: "text/plain",
      parent,
    }),
    client.translateText({
      contents: [text],
      sourceLanguageCode: sourceLocale,
      targetLanguageCode: "fr",
      mimeType: "text/plain",
      parent,
    }),
    client.translateText({
      contents: [text],
      sourceLanguageCode: sourceLocale,
      targetLanguageCode: "de",
      mimeType: "text/plain",
      parent,
    }),
  ]);

  const en = enResult[0].translations?.[0]?.translatedText;
  const fr = frResult[0].translations?.[0]?.translatedText;
  const de = deResult[0].translations?.[0]?.translatedText;

  if (!en || !fr || !de) {
    throw new Error("Google Translate returned an empty translation response");
  }

  return { en, fr, de };
}
