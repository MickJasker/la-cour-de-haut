import { describe, it, expect } from "vitest";
import {
  resolveReviewBody,
  reviewTranslatedFrom,
  buildReviewBody,
} from "./review-i18n";

describe("resolveReviewBody", () => {
  it("returns the visitor's own locale slot when present", () => {
    const review = {
      body: { nl: "Mooi huis", en: "Lovely house" },
      originalBody: "Lovely house",
    };

    expect(resolveReviewBody(review, "en")).toBe("Lovely house");
    expect(resolveReviewBody(review, "nl")).toBe("Mooi huis");
  });

  it("falls back through nl → en → fr → de → original when the locale slot is missing", () => {
    // fr missing: the chain prefers en (earlier) over de (later)
    expect(
      resolveReviewBody(
        { body: { en: "EN", de: "DE" }, originalBody: "x" },
        "fr",
      ),
    ).toBe("EN");
    // only de translated so far
    expect(
      resolveReviewBody({ body: { de: "DE" }, originalBody: "x" }, "fr"),
    ).toBe("DE");
    // nothing translated yet → the verbatim original (lenient publish)
    expect(
      resolveReviewBody({ body: {}, originalBody: "Bella casa" }, "fr"),
    ).toBe("Bella casa");
  });
});

describe("reviewTranslatedFrom", () => {
  it("reports the original language when reading a machine slot in the visitor's locale", () => {
    const review = {
      bodySource: { en: "human" as const, nl: "machine" as const },
      originalLocale: "en",
    };
    // a Dutch visitor reads the machine-translated nl slot of an English review
    expect(reviewTranslatedFrom(review, "nl")).toBe("en");
  });

  it("shows no marker on a human slot or a cross-locale fallback", () => {
    const review = {
      bodySource: { en: "human" as const, nl: "machine" as const },
      originalLocale: "en",
    };
    // reading the human original-language slot → no marker
    expect(reviewTranslatedFrom(review, "en")).toBeNull();
    // fr slot absent (visitor falls back to another locale) → no marker
    expect(reviewTranslatedFrom(review, "fr")).toBeNull();
  });

  it("passes through the und sentinel for a foreign original", () => {
    const review = {
      bodySource: { nl: "machine" as const },
      originalLocale: "und",
    };
    expect(reviewTranslatedFrom(review, "nl")).toBe("und");
  });
});

describe("buildReviewBody", () => {
  it("seeds the original-locale slot as human and marks translations machine", () => {
    const result = buildReviewBody({
      originalLocale: "en",
      originalBody: "Lovely house",
      translations: { nl: "Mooi huis", fr: "Belle maison", de: "Schönes Huis" },
    });

    expect(result.body).toEqual({
      en: "Lovely house",
      nl: "Mooi huis",
      fr: "Belle maison",
      de: "Schönes Huis",
    });
    expect(result.bodySource).toEqual({
      en: "human",
      nl: "machine",
      fr: "machine",
      de: "machine",
    });
  });

  it("marks every slot machine and seeds no human slot for a foreign original", () => {
    const result = buildReviewBody({
      originalLocale: "it",
      originalBody: "Bella casa",
      translations: { nl: "Mooi", en: "Lovely", fr: "Joli", de: "Schön" },
    });

    expect(result.body).toEqual({
      nl: "Mooi",
      en: "Lovely",
      fr: "Joli",
      de: "Schön",
    });
    expect(result.bodySource).toEqual({
      nl: "machine",
      en: "machine",
      fr: "machine",
      de: "machine",
    });
  });

  it("seeds only the human original slot when no translations exist yet", () => {
    expect(
      buildReviewBody({
        originalLocale: "en",
        originalBody: "Lovely",
        translations: {},
      }),
    ).toEqual({ body: { en: "Lovely" }, bodySource: { en: "human" } });
  });

  it("yields empty maps for a foreign original with no translations", () => {
    expect(
      buildReviewBody({
        originalLocale: "it",
        originalBody: "Bella casa",
        translations: {},
      }),
    ).toEqual({ body: {}, bodySource: {} });
  });
});
