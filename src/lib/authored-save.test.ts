/**
 * Tests for the authored-save pipeline's diff/gap-fill glue (`resolveAuthoredFields`,
 * ADR-0016). `resolveAuthoredField` itself (the per-field engine) is already
 * unit-tested in isolation via injected `translate` stubs — see
 * `localized-field.test.ts`. This file exercises the layer on top of it: the
 * bug class it exists to prevent is a save action reconstructing a field's
 * "stored" projection incorrectly (e.g. a mistyped key, or a wrong
 * type-guard) so the pipeline believes nothing is stored and silently
 * re-translates every locale on every save, even when the owner changed
 * nothing.
 *
 * Real (non-mocked) translation seams are used throughout, matching
 * `localized-field.test.ts` / `localized-detail.test.ts`'s own pattern:
 * `E2E_TESTING=1` resolves to the deterministic stub adapter
 * (`translate-stub-adapter.ts`, already wired into `getTranslateAdapter()`
 * for exactly this purpose) for the happy-path/gap-fill/bug-class tests, and
 * the real Google adapter — which fails fast and for real with no
 * credentials configured — is used for the failure-aggregation test. No
 * module internals are mocked.
 */
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { htmlToEditorState } from "@/lib/lexical/bridge";
import {
  resolveAuthoredFields,
  type AuthoredTextFieldInput,
  type AuthoredDetailFieldInput,
} from "./authored-save";
import type { Localized } from "@/lib/translation/localized-field";

function textField(
  source: string,
  stored?: Localized<string>,
): AuthoredTextFieldInput {
  return { kind: "text", source, stored };
}

function detailField(
  source: Awaited<ReturnType<typeof htmlToEditorState>> | null,
  stored?: Localized<Awaited<ReturnType<typeof htmlToEditorState>>>,
): AuthoredDetailFieldInput {
  return { kind: "detail", source, stored };
}

describe("resolveAuthoredFields — diff/gap-fill glue (E2E stub adapter)", () => {
  beforeEach(() => {
    process.env.E2E_TESTING = "1";
  });
  afterEach(() => {
    delete process.env.E2E_TESTING;
  });

  it("threads each field's own stored value: unchanged sources pass through untouched, no retranslation", async () => {
    const storedTitle = {
      nl: "Hallo",
      en: "Hello",
      fr: "Bonjour",
      de: "Hallo DE",
    };
    const storedBody = { nl: "Wereld", en: "World", fr: "Monde", de: "Welt" };

    const fields = {
      title: textField("Hallo", storedTitle),
      body: textField("Wereld", storedBody),
    };

    const { resolved, failures } = await resolveAuthoredFields(fields);

    expect(resolved.title.value).toEqual(storedTitle);
    expect(resolved.body.value).toEqual(storedBody);
    expect(failures).toEqual([]);
  });

  it("gap-fills only the missing locale per field, independently across fields", async () => {
    const fields = {
      // fr missing for title
      title: textField("Hallo", { nl: "Hallo", en: "Hello", de: "Hallo DE" }),
      // en missing for body
      body: textField("Wereld", { nl: "Wereld", fr: "Monde", de: "Welt" }),
    };

    const { resolved } = await resolveAuthoredFields(fields);

    expect(resolved.title.value.fr).toBe("Hallo [fr]");
    expect(resolved.title.value.en).toBe("Hello"); // untouched, copied from stored
    expect(resolved.body.value.en).toBe("Wereld [en]");
    expect(resolved.body.value.fr).toBe("Monde"); // untouched, copied from stored
  });

  it("bug class: a stored-projection mistake that drops the stored row silently re-translates every locale, even though nothing changed", async () => {
    // Simulates a call site's stored-row reconstruction being wrong (a
    // mistyped key, or a wrong `type` guard on the loaded row) so `stored`
    // comes back `undefined` even though the DB actually has a real,
    // unchanged row. Compare to the first test above, where correctly-wired
    // `stored` causes translation to be skipped entirely for the very same
    // source text.
    const fields = { title: textField("Hallo", undefined) };

    const { resolved } = await resolveAuthoredFields(fields);

    expect(resolved.title.value).toEqual({
      nl: "Hallo",
      en: "Hallo [en]",
      fr: "Hallo [fr]",
      de: "Hallo [de]",
    });
  });

  it("resolves mixed text + detail fields independently", async () => {
    const detailSource = await htmlToEditorState("<p>Bonjour</p>");
    const fields = {
      title: textField("Hallo", undefined),
      detail: detailField(detailSource, undefined),
    };

    const { resolved } = await resolveAuthoredFields(fields);

    expect(resolved.title.value.nl).toBe("Hallo");
    expect(resolved.detail).not.toBeNull();
    expect(resolved.detail!.value.en).toBeDefined();
  });

  it("a detail field with no submitted source (null) resolves to null and is never translated", async () => {
    const fields = { detail: detailField(null, undefined) };

    const { resolved } = await resolveAuthoredFields(fields);

    expect(resolved.detail).toBeNull();
  });
});

describe("resolveAuthoredFields — failure aggregation (real, uncredentialed adapter)", () => {
  const prevCreds = process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON;
  const prevE2E = process.env.E2E_TESTING;

  beforeEach(() => {
    delete process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON;
    delete process.env.E2E_TESTING;
  });
  afterEach(() => {
    if (prevCreds === undefined) {
      delete process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON;
    } else {
      process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON = prevCreds;
    }
    if (prevE2E === undefined) {
      delete process.env.E2E_TESTING;
    } else {
      process.env.E2E_TESTING = prevE2E;
    }
  });

  it("dedupes the same failed locale across multiple fields into one union", async () => {
    // No Google credentials in the test environment, so every target-locale
    // call for both fields fails for real (not mocked) — the union across
    // fields must still be exactly the three locale codes, not six
    // duplicate entries, and the source always persists regardless.
    const fields = {
      title: textField("Hallo", undefined),
      body: textField("Wereld", undefined),
    };

    const { resolved, failures } = await resolveAuthoredFields(fields);

    expect([...failures].sort()).toEqual(["de", "en", "fr"]);
    expect(resolved.title.value.nl).toBe("Hallo");
    expect(resolved.body.value.nl).toBe("Wereld");
  });
});
