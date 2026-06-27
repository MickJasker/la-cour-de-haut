export async function translateToAllLocales(
  text: string,
  sourceLocale = "nl",
): Promise<{ en: string; fr: string; de: string }> {
  if (process.env.E2E_TESTING) {
    return { en: `${text} [en]`, fr: `${text} [fr]`, de: `${text} [de]` };
  }

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

  const parent = `projects/${creds.project_id}/locations/global`;

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
