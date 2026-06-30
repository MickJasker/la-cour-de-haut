import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const mockTranslateText = vi.fn();
function MockClient() {}
MockClient.prototype.translateText = mockTranslateText;

vi.mock("@google-cloud/translate", () => ({
  v3: { TranslationServiceClient: MockClient },
}));

// Import after mock is registered
const { translateToAllLocales, translateReviewBody, translateText } =
  await import("./translate");

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

describe("translateReviewBody", () => {
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

  it("translates a known non-Dutch source into the other three locales only", async () => {
    // targets for source "en" are nl, fr, de (in DISPLAY_LOCALES order)
    mockTranslateText
      .mockResolvedValueOnce([{ translations: [{ translatedText: "Mooi" }] }]) // nl
      .mockResolvedValueOnce([{ translations: [{ translatedText: "Joli" }] }]) // fr
      .mockResolvedValueOnce([{ translations: [{ translatedText: "Schön" }] }]); // de

    const result = await translateReviewBody("Lovely", "en");

    expect(result.detectedSource).toBe("en");
    expect(result.translations).toEqual({
      nl: "Mooi",
      fr: "Joli",
      de: "Schön",
    });
    // the source locale is never machine-translated against itself
    expect(result.translations).not.toHaveProperty("en");
    expect(mockTranslateText).toHaveBeenCalledWith(
      expect.objectContaining({
        sourceLanguageCode: "en",
        targetLanguageCode: "nl",
      }),
    );
  });

  it("auto-detects an out-of-set source and fills all four display locales", async () => {
    const reply = (txt: string) => [
      { translations: [{ translatedText: txt, detectedLanguageCode: "it" }] },
    ];
    mockTranslateText
      .mockResolvedValueOnce(reply("NL")) // nl
      .mockResolvedValueOnce(reply("EN")) // en
      .mockResolvedValueOnce(reply("FR")) // fr
      .mockResolvedValueOnce(reply("DE")); // de

    const result = await translateReviewBody("Bella casa", "und");

    expect(result.detectedSource).toBe("it");
    expect(result.translations).toEqual({
      nl: "NL",
      en: "EN",
      fr: "FR",
      de: "DE",
    });
    // auto-detect mode must not pin a source language
    expect(mockTranslateText).toHaveBeenCalledWith(
      expect.not.objectContaining({ sourceLanguageCode: expect.anything() }),
    );
  });

  it("auto-detects an in-set source and drops that slot from the machine output", async () => {
    const reply = (txt: string) => [
      { translations: [{ translatedText: txt, detectedLanguageCode: "en" }] },
    ];
    mockTranslateText
      .mockResolvedValueOnce(reply("NL")) // nl
      .mockResolvedValueOnce(reply("EN")) // en — dropped (it is the source)
      .mockResolvedValueOnce(reply("FR")) // fr
      .mockResolvedValueOnce(reply("DE")); // de

    const result = await translateReviewBody("Lovely", "und");

    expect(result.detectedSource).toBe("en");
    expect(result.translations).toEqual({ nl: "NL", fr: "FR", de: "DE" });
    expect(result.translations).not.toHaveProperty("en");
  });

  it("returns deterministic stubs under E2E without calling Google", async () => {
    process.env.E2E_TESTING = "1";
    try {
      const result = await translateReviewBody("Lovely", "en");
      expect(result.detectedSource).toBe("en");
      expect(result.translations).toEqual({
        nl: "Lovely [nl]",
        fr: "Lovely [fr]",
        de: "Lovely [de]",
      });
      expect(mockTranslateText).not.toHaveBeenCalled();
    } finally {
      delete process.env.E2E_TESTING;
    }
  });
});

describe("translateText", () => {
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

  it("calls GCloud with correct params and returns the translated string", async () => {
    mockTranslateText.mockResolvedValueOnce([
      { translations: [{ translatedText: "Hello world" }] },
    ]);

    const result = await translateText("Hallo wereld", "en");

    expect(result).toBe("Hello world");
    expect(mockTranslateText).toHaveBeenCalledTimes(1);
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

  it("respects opts.sourceLocale and opts.mimeType overrides", async () => {
    mockTranslateText.mockResolvedValueOnce([
      { translations: [{ translatedText: "<p>Bonjour</p>" }] },
    ]);

    const result = await translateText("Hello", "fr", {
      sourceLocale: "en",
      mimeType: "text/html",
    });

    expect(result).toBe("<p>Bonjour</p>");
    expect(mockTranslateText).toHaveBeenCalledWith(
      expect.objectContaining({
        sourceLanguageCode: "en",
        targetLanguageCode: "fr",
        mimeType: "text/html",
      }),
    );
  });

  it("returns deterministic stub under E2E without calling Google", async () => {
    process.env.E2E_TESTING = "1";
    try {
      const result = await translateText("x", "en");
      expect(result).toBe("x [en]");
      expect(mockTranslateText).not.toHaveBeenCalled();
    } finally {
      delete process.env.E2E_TESTING;
    }
  });
});
