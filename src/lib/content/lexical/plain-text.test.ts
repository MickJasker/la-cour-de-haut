import { describe, expect, it } from "vitest";
import { editorStateFromBlocks } from "./build-state";
import { EMPTY_EDITOR_STATE } from "./empty-state";
import { editorStateToPlainText } from "./plain-text";

describe("editorStateToPlainText", () => {
  it("joins blocks with a space so words never glue together", () => {
    const state = editorStateFromBlocks([
      { type: "heading", text: "Uw rechten" },
      { type: "paragraph", children: ["U heeft het recht op inzage."] },
    ]);
    expect(editorStateToPlainText(state)).toBe(
      "Uw rechten U heeft het recht op inzage.",
    );
  });

  it("includes link text inline without separators", () => {
    const state = editorStateFromBlocks([
      {
        type: "paragraph",
        children: [
          "Zie het ",
          { text: "addendum", href: "https://example.com" },
          " voor details.",
        ],
      },
    ]);
    expect(editorStateToPlainText(state)).toBe(
      "Zie het addendum voor details.",
    );
  });

  it("returns an empty string for an empty editor state", () => {
    expect(editorStateToPlainText(EMPTY_EDITOR_STATE)).toBe("");
  });
});
