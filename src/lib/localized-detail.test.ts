/**
 * Tests for resolveLocalizedDetail (ADR-0016).
 *
 * Runs under jsdom (the vitest default), which provides an ambient DOM so the
 * Lexical bridge's editorStateToHtml/htmlToEditorState work without spinning
 * up happy-dom. The translateText call is stubbed by setting E2E_TESTING=1 so
 * no real Google Translate API call is made.
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { hasEditorText, EMPTY_EDITOR_STATE } from "@/lib/lexical/empty-state";
import { htmlToEditorState } from "@/lib/lexical/bridge";
import { resolveLocalizedDetail } from "@/lib/localized-detail";

/**
 * Deep-clones `value`, reversing every plain object's key order at every
 * level (array order is left alone). Simulates a Postgres `jsonb` round-trip:
 * Postgres canonicalizes object key order on read-back, while a value fresh
 * out of the Lexical editor keeps the editor's own serialization order. Two
 * states that differ only by this reordering must compare as equal.
 */
function shuffleKeys<T>(value: T): T {
  if (Array.isArray(value)) {
    return value.map((item) => shuffleKeys(item)) as unknown as T;
  }
  if (value !== null && typeof value === "object") {
    const entries = Object.entries(value as Record<string, unknown>).reverse();
    const result: Record<string, unknown> = {};
    for (const [key, v] of entries) {
      result[key] = shuffleKeys(v);
    }
    return result as unknown as T;
  }
  return value;
}

describe("resolveLocalizedDetail", () => {
  beforeAll(() => {
    process.env.E2E_TESTING = "1";
  });
  afterAll(() => {
    delete process.env.E2E_TESTING;
  });

  it("translates a non-empty nl EditorState into en/fr/de with correct source map", async () => {
    const source = await htmlToEditorState(
      "<h2>Bayeux</h2><p>Bezoek de kathedraal.</p>",
    );

    const result = await resolveLocalizedDetail(source);

    // All target locales are present.
    expect(result.value.en).toBeDefined();
    expect(result.value.fr).toBeDefined();
    expect(result.value.de).toBeDefined();

    // Source map: nl is human, all targets are machine.
    expect(result.source).toEqual({
      nl: "human",
      en: "machine",
      fr: "machine",
      de: "machine",
    });

    // No translation failures.
    expect(result.failures).toHaveLength(0);

    // The translated states contain text (the stub appends " [locale]" to the
    // HTML, so at minimum that text node exists after the bridge round-trip).
    expect(hasEditorText(result.value.en!)).toBe(true);
    expect(hasEditorText(result.value.fr!)).toBe(true);
    expect(hasEditorText(result.value.de!)).toBe(true);
  });

  it("returns nl-only when source is EMPTY_EDITOR_STATE (no text content)", async () => {
    const result = await resolveLocalizedDetail(EMPTY_EDITOR_STATE);

    // Source locale is preserved.
    expect(result.value.nl).toBe(EMPTY_EDITOR_STATE);

    // No target locales are created.
    expect(result.value.en).toBeUndefined();
    expect(result.value.fr).toBeUndefined();
    expect(result.value.de).toBeUndefined();

    // Source map: only nl.
    expect(result.source).toEqual({ nl: "human" });

    // No failures (empty source → translate nothing).
    expect(result.failures).toHaveLength(0);
  });

  it("gap-fills missing targets when source is unchanged and a locale is absent", async () => {
    const source = await htmlToEditorState("<p>Ongewijzigd.</p>");

    // Simulate a stored value where en/fr are present but de is missing.
    const enState = await htmlToEditorState("<p>Unchanged. [en]</p>");
    const frState = await htmlToEditorState("<p>Inchangé. [fr]</p>");
    const stored = { nl: source, en: enState, fr: frState };

    const result = await resolveLocalizedDetail(source, stored);

    // de is gap-filled; en/fr are passed through.
    expect(result.value.de).toBeDefined();
    expect(result.value.en).toBe(enState); // unchanged, copied from stored
    expect(result.value.fr).toBe(frState); // unchanged, copied from stored
    expect(result.source.de).toBe("machine");
    expect(result.failures).toHaveLength(0);
  });

  it("re-translates all targets when the nl source changes", async () => {
    const oldSource = await htmlToEditorState("<p>Oud.</p>");
    const newSource = await htmlToEditorState("<p>Nieuw.</p>");
    const oldEn = await htmlToEditorState("<p>Old. [en]</p>");
    const stored = { nl: oldSource, en: oldEn };

    const result = await resolveLocalizedDetail(newSource, stored);

    // All targets re-translated (even though en was stored).
    expect(result.value.en).toBeDefined();
    // The new translation is different from the old stored en (stub includes "Nieuw").
    expect(result.value.en).not.toBe(oldEn);
    expect(result.source.en).toBe("machine");
  });

  it("regression: treats source as unchanged when stored differs only by jsonb key order", async () => {
    // Same content as `source` below, but freshly built so the test doesn't
    // rely on object-reference reuse (which would trivially pass without
    // exercising the comparison logic at all).
    const source = await htmlToEditorState("<p>Ongewijzigd.</p>");
    const enState = await htmlToEditorState("<p>Unchanged. [en]</p>");
    const frState = await htmlToEditorState("<p>Inchangé. [fr]</p>");
    const deState = await htmlToEditorState("<p>Unverändert. [de]</p>");

    // Simulate the jsonb round-trip on every stored slot, including `nl`
    // (the source-comparison slot) — Postgres canonicalizes key order on
    // read-back for all jsonb columns, not just the targets.
    const stored = {
      nl: shuffleKeys(source),
      en: shuffleKeys(enState),
      fr: shuffleKeys(frState),
      de: shuffleKeys(deState),
    };

    const result = await resolveLocalizedDetail(source, stored);

    // Source treated as UNCHANGED despite the key-order difference, so every
    // target is passed straight through from `stored` (no re-translation —
    // a re-translation would produce a brand-new object, breaking `toBe`).
    expect(result.value.en).toBe(stored.en);
    expect(result.value.fr).toBe(stored.fr);
    expect(result.value.de).toBe(stored.de);
    expect(result.failures).toHaveLength(0);
  });
});
