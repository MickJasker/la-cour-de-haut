import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const mockTranslateText = vi.fn();
function MockClient() {}
MockClient.prototype.translateText = mockTranslateText;

vi.mock("@google-cloud/translate/build/src/v3", () => ({
  TranslationServiceClient: MockClient,
}));

// Import after mock is registered
const { translateToAllLocales } = await import("./translate");

describe("translateToAllLocales", () => {
  const fakeCreds = {
    project_id: "my-gcp-project",
    client_email: "sa@my-gcp-project.iam.gserviceaccount.com",
    private_key:
      "-----BEGIN RSA PRIVATE KEY-----\nfake\n-----END RSA PRIVATE KEY-----\n",
  };

  beforeEach(() => {
    process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON = JSON.stringify(fakeCreds);
    mockTranslateText.mockClear();
  });

  afterEach(() => {
    delete process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON;
  });

  it("calls GCloud with correct params and returns { en, fr, de }", async () => {
    mockTranslateText
      .mockResolvedValueOnce([
        { translations: [{ translatedText: "Hello world" }] },
      ])
      .mockResolvedValueOnce([
        { translations: [{ translatedText: "Bonjour le monde" }] },
      ])
      .mockResolvedValueOnce([
        { translations: [{ translatedText: "Hallo Welt" }] },
      ]);

    const result = await translateToAllLocales("Hallo wereld");

    expect(result).toEqual({
      en: "Hello world",
      fr: "Bonjour le monde",
      de: "Hallo Welt",
    });

    expect(mockTranslateText).toHaveBeenCalledTimes(3);
    expect(mockTranslateText).toHaveBeenCalledWith(
      expect.objectContaining({
        contents: ["Hallo wereld"],
        sourceLanguageCode: "nl",
        targetLanguageCode: "en",
        mimeType: "text/plain",
        parent: "projects/my-gcp-project/locations/global",
      }),
    );
  });

  it("reads project ID from the credentials JSON env var", async () => {
    const otherCreds = { ...fakeCreds, project_id: "other-project-999" };
    process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON =
      JSON.stringify(otherCreds);

    mockTranslateText.mockResolvedValue([
      { translations: [{ translatedText: "x" }] },
    ]);

    await translateToAllLocales("tekst");

    expect(mockTranslateText).toHaveBeenCalledWith(
      expect.objectContaining({
        parent: "projects/other-project-999/locations/global",
      }),
    );
  });

  it("throws if GOOGLE_APPLICATION_CREDENTIALS_JSON is not set", async () => {
    delete process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON;

    await expect(translateToAllLocales("tekst")).rejects.toThrow(
      /GOOGLE_APPLICATION_CREDENTIALS_JSON/,
    );
  });
});
