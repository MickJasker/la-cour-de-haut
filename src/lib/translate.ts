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
  return translateAllLocales(text, sourceLocale, "text/plain");
}

/**
 * Like `translateToAllLocales` but for HTML: Google preserves inline tags and
 * translates whole sentences, so bold/links mid-sentence survive. Used by the
 * POI rich-detail bridge (EditorState -> HTML -> here -> HTML -> EditorState).
 * See ADR-0015.
 */
export async function translateHtmlToAllLocales(
  html: string,
  sourceLocale = "nl",
): Promise<{ en: string; fr: string; de: string }> {
  return translateAllLocales(html, sourceLocale, "text/html");
}

async function translateAllLocales(
  content: string,
  sourceLocale: string,
  mimeType: "text/plain" | "text/html",
): Promise<{ en: string; fr: string; de: string }> {
  if (process.env.E2E_TESTING) {
    return {
      en: `${content} [en]`,
      fr: `${content} [fr]`,
      de: `${content} [de]`,
    };
  }

  const { client, parent } = await getTranslationClient();

  const [enResult, frResult, deResult] = await Promise.all(
    (["en", "fr", "de"] as const).map((targetLanguageCode) =>
      client.translateText({
        contents: [content],
        sourceLanguageCode: sourceLocale,
        targetLanguageCode,
        mimeType,
        parent,
      }),
    ),
  );

  const en = enResult[0].translations?.[0]?.translatedText;
  const fr = frResult[0].translations?.[0]?.translatedText;
  const de = deResult[0].translations?.[0]?.translatedText;

  if (!en || !fr || !de) {
    throw new Error("Google Translate returned an empty translation response");
  }

  return { en, fr, de };
}

/**
 * Translates a single string into one target locale. Used by the auto-translate
 * save actions (ADR-0016) which need per-locale control (allSettled fan-out,
 * gap-fill, failure isolation). Unlike `translateToAllLocales` / `translateHtmlToAllLocales`
 * this returns only the requested target so callers can compose the fan-out themselves.
 */
export async function translateText(
  text: string,
  target: "en" | "fr" | "de",
  opts?: { sourceLocale?: string; mimeType?: "text/plain" | "text/html" },
): Promise<string> {
  const sourceLocale = opts?.sourceLocale ?? "nl";
  const mimeType = opts?.mimeType ?? "text/plain";

  if (process.env.E2E_TESTING) {
    return `${text} [${target}]`;
  }

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
