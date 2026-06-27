export async function translateToAllLocales(
  text: string,
  sourceLocale = "nl",
): Promise<{ en: string; fr: string; de: string }> {
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

  return {
    en: enResult[0].translations![0].translatedText!,
    fr: frResult[0].translations![0].translatedText!,
    de: deResult[0].translations![0].translatedText!,
  };
}
