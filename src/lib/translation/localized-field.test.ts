import { describe, it, expect } from "vitest";
import {
  pickLocalized,
  resolveAuthoredField,
  resolveLocalizedText,
  type TargetLocale,
} from "./localized-field";

// ---------------------------------------------------------------------------
// Shared test helpers
// ---------------------------------------------------------------------------

/** Happy-path stub: returns `"${source} [${target}]"`. */
const stub = async (s: string, t: TargetLocale): Promise<string> =>
  `${s} [${t}]`;

/** Stub that throws for the specified target(s). */
const failFor =
  (...failTargets: TargetLocale[]) =>
  async (s: string, t: TargetLocale): Promise<string> => {
    if (failTargets.includes(t)) throw new Error(`translate failed for ${t}`);
    return `${s} [${t}]`;
  };

const isEmpty = (v: string | undefined) => !v || v.trim() === "";
const equals = (a: string, b: string) => a === b;

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("resolveAuthoredField", () => {
  // 1. Create (no stored): every target is translated.
  it("1. create — translates all target locales", async () => {
    const { value, source, failures } = await resolveAuthoredField({
      source: "Hallo",
      stored: undefined,
      isEmpty,
      equals,
      translate: stub,
    });

    expect(value).toEqual({
      nl: "Hallo",
      en: "Hallo [en]",
      fr: "Hallo [fr]",
      de: "Hallo [de]",
    });
    expect(source).toEqual({
      nl: "human",
      en: "machine",
      fr: "machine",
      de: "machine",
    });
    expect(failures).toEqual([]);
  });

  // 2. Unchanged source + all targets present: translator never called, stored
  //    value passed through unchanged (nl slot reset to incoming source).
  it("2. unchanged source + all targets present — translator not called, stored returned", async () => {
    // Fewer params than the type — valid TypeScript callback compatibility.
    const translateSpy = async (): Promise<string> => {
      throw new Error("translate should not be called");
    };

    const stored = {
      nl: "Hallo",
      en: "Hello",
      fr: "Bonjour",
      de: "Hallo DE",
    };

    const { value, source, failures } = await resolveAuthoredField({
      source: "Hallo",
      stored,
      isEmpty,
      equals,
      translate: translateSpy,
    });

    expect(value).toEqual({
      nl: "Hallo",
      en: "Hello",
      fr: "Bonjour",
      de: "Hallo DE",
    });
    expect(source).toEqual({
      nl: "human",
      en: "machine",
      fr: "machine",
      de: "machine",
    });
    expect(failures).toEqual([]);
  });

  // 3. Source changed: ALL targets are re-translated and overwritten.
  it("3. source changed — re-translates all targets unconditionally", async () => {
    const stored = {
      nl: "Oud",
      en: "Old",
      fr: "Ancien",
      de: "Alt",
    };

    const { value, source, failures } = await resolveAuthoredField({
      source: "Nieuw",
      stored,
      isEmpty,
      equals,
      translate: stub,
    });

    expect(value).toEqual({
      nl: "Nieuw",
      en: "Nieuw [en]",
      fr: "Nieuw [fr]",
      de: "Nieuw [de]",
    });
    expect(source).toEqual({
      nl: "human",
      en: "machine",
      fr: "machine",
      de: "machine",
    });
    expect(failures).toEqual([]);
  });

  // 4. Gap-fill: source unchanged but one target missing → only that target is
  //    translated; the others are kept from stored unchanged.
  it("4. gap-fill — only translates the missing target locale", async () => {
    let translateCallCount = 0;
    const trackingStub = async (
      s: string,
      t: TargetLocale,
    ): Promise<string> => {
      translateCallCount++;
      return `${s} [${t}]`;
    };

    const stored = {
      nl: "Hallo",
      en: "Hello",
      // fr is missing (gap)
      de: "Hallo DE",
    };

    const { value, source, failures } = await resolveAuthoredField({
      source: "Hallo",
      stored,
      isEmpty,
      equals,
      translate: trackingStub,
    });

    expect(translateCallCount).toBe(1);
    expect(value).toEqual({
      nl: "Hallo",
      en: "Hello",
      fr: "Hallo [fr]",
      de: "Hallo DE",
    });
    expect(source).toEqual({
      nl: "human",
      en: "machine",
      fr: "machine",
      de: "machine",
    });
    expect(failures).toEqual([]);
  });

  // 5. Per-locale failure (allSettled): fr throws but en/de succeed.
  //    en+de are present+machine; fr is absent (no stored fr) in failures[].
  it("5. per-locale failure — en+de succeed, fr fails, no stored fr to fall back to", async () => {
    const stored = {
      nl: "Oud",
      en: "Old",
      fr: "Ancien",
      de: "Alt",
    };

    // Source changed so all three targets are attempted.
    const { value, source, failures } = await resolveAuthoredField({
      source: "Nieuw",
      stored,
      isEmpty,
      equals,
      translate: failFor("fr"),
    });

    expect(failures).toEqual(["fr"]);
    // nl always equals source
    expect(value.nl).toBe("Nieuw");
    // successful locales have new machine translation
    expect(value.en).toBe("Nieuw [en]");
    expect(value.de).toBe("Nieuw [de]");
    // fr failed → falls back to previously stored fr
    expect(value.fr).toBe("Ancien");
    expect(source).toEqual({
      nl: "human",
      en: "machine",
      fr: "machine",
      de: "machine",
    });
  });

  it("5b. per-locale failure — fr absent from stored, so fr absent from result", async () => {
    // No prior stored value for fr at all.
    const stored = {
      nl: "Oud",
      en: "Old",
      de: "Alt",
    };

    const { value, source, failures } = await resolveAuthoredField({
      source: "Nieuw",
      stored,
      isEmpty,
      equals,
      translate: failFor("fr"),
    });

    expect(failures).toEqual(["fr"]);
    expect(value.nl).toBe("Nieuw");
    expect(value.en).toBe("Nieuw [en]");
    expect(value.de).toBe("Nieuw [de]");
    // fr has no stored fallback → absent from value and source map
    expect(value.fr).toBeUndefined();
    expect(source.fr).toBeUndefined();
    expect(source).toEqual({ nl: "human", en: "machine", de: "machine" });
  });

  // 6. Empty source: no targets translated, result is nl-only.
  it("6. empty source — no translation, returns bare nl-only value", async () => {
    // Fewer params than the type — valid TypeScript callback compatibility.
    const translateSpy = async (): Promise<string> => {
      throw new Error("translate should not be called for empty source");
    };

    const { value, source, failures } = await resolveAuthoredField({
      source: "",
      stored: undefined,
      isEmpty,
      equals,
      translate: translateSpy,
    });

    expect(value).toEqual({ nl: "" });
    expect(source).toEqual({ nl: "human" });
    expect(failures).toEqual([]);
  });
});

describe("resolveLocalizedText", () => {
  // Uses E2E_TESTING stub so no Google credentials needed.
  // Smoke-tests that the wiring into resolveAuthoredField is correct.

  it("create — translates via the E2E stub (nl → [en]/[fr]/[de])", async () => {
    const prev = process.env.E2E_TESTING;
    process.env.E2E_TESTING = "1";
    try {
      const { value, source, failures } = await resolveLocalizedText("Hallo");
      expect(value).toEqual({
        nl: "Hallo",
        en: "Hallo [en]",
        fr: "Hallo [fr]",
        de: "Hallo [de]",
      });
      expect(source).toEqual({
        nl: "human",
        en: "machine",
        fr: "machine",
        de: "machine",
      });
      expect(failures).toEqual([]);
    } finally {
      if (prev === undefined) {
        delete process.env.E2E_TESTING;
      } else {
        process.env.E2E_TESTING = prev;
      }
    }
  });

  it("unchanged source + full stored — no translation call, stored returned as-is", async () => {
    const prev = process.env.E2E_TESTING;
    process.env.E2E_TESTING = "1";
    try {
      const stored = {
        nl: "Hallo",
        en: "Hello",
        fr: "Bonjour",
        de: "Hallo DE",
      };
      const { value, source, failures } = await resolveLocalizedText(
        "Hallo",
        stored,
      );
      expect(value).toEqual(stored);
      expect(source).toEqual({
        nl: "human",
        en: "machine",
        fr: "machine",
        de: "machine",
      });
      expect(failures).toEqual([]);
    } finally {
      if (prev === undefined) {
        delete process.env.E2E_TESTING;
      } else {
        process.env.E2E_TESTING = prev;
      }
    }
  });
});

describe("pickLocalized", () => {
  it("returns the active locale's slot when present", () => {
    const field = { nl: "Hallo", en: "Hello", fr: "Bonjour", de: "Hallo DE" };
    expect(pickLocalized(field, "en")).toBe("Hello");
    expect(pickLocalized(field, "fr")).toBe("Bonjour");
  });

  it("falls back to nl when the active locale is missing", () => {
    // fr/de not yet translated (e.g. right after a save).
    const field = { nl: "Hallo", en: "Hello" };
    expect(pickLocalized(field, "fr")).toBe("Hallo");
    expect(pickLocalized(field, "de")).toBe("Hallo");
  });

  it("returns nl itself when the active locale IS nl", () => {
    const field = { nl: "Hallo", en: "Hello" };
    expect(pickLocalized(field, "nl")).toBe("Hallo");
  });

  // Matches current call-site behavior: an empty-string translation is a
  // present (falsy but defined) value, not "missing" — `??` only falls back
  // on null/undefined, so an empty string is returned as-is rather than
  // triggering the nl fallback.
  it("returns an empty-string locale slot as-is, not the nl fallback", () => {
    const field = { nl: "Hallo", en: "" };
    expect(pickLocalized(field, "en")).toBe("");
  });

  // Matches current call-site behavior when nl itself is empty (source was
  // saved blank): an empty nl is still a defined value, so it is returned
  // rather than producing `undefined`.
  it("returns an empty-string nl as the fallback when the locale is missing", () => {
    const field = { nl: "" };
    expect(pickLocalized(field, "en")).toBe("");
  });
});
