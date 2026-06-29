/**
 * @vitest-environment node
 *
 * The main bridge.test.ts runs under jsdom (ambient DOM), so it never exercises
 * the lazy happy-dom branch. This file forces the production path: in the `node`
 * environment there is no global document/DOMParser, so `withDom` spins up
 * happy-dom — the same code path the server translation action uses. It guards
 * against a happy-dom/Lexical incompatibility that jsdom would mask.
 */
import { describe, it, expect } from "vitest";
import { editorStateToHtml, htmlToEditorState } from "./bridge";

describe("lexical bridge (happy-dom path)", () => {
  it("has no ambient DOM in this environment", () => {
    expect(typeof document).toBe("undefined");
  });

  it("round-trips rich content through the lazily-loaded happy-dom DOM", async () => {
    const html =
      '<h2>Bayeux</h2><p>zie de <a href="https://x.test">site</a></p><ul><li>een</li></ul>';
    const state = await htmlToEditorState(html);
    const out = await editorStateToHtml(state);

    expect(out).toContain("<h2");
    expect(out).toContain("Bayeux");
    expect(out).toContain('href="https://x.test"');
    expect(out).toContain("<ul");
    expect(out).toContain("een");
  });

  it("restores the absence of a global document afterward", () => {
    // withDom must not leak happy-dom's globals into the runtime.
    expect(typeof document).toBe("undefined");
  });
});
