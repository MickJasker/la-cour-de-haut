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
});
