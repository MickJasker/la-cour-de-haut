import { describe, expect, it } from "vitest";
import { editorStateToHtml } from "./bridge";
import { hasEditorText } from "./empty-state";
import { editorStateFromBlocks } from "./build-state";

describe("editorStateFromBlocks", () => {
  it("builds headings and paragraphs that render to the expected HTML", async () => {
    const state = editorStateFromBlocks([
      { type: "heading", text: "Welke gegevens" },
      { type: "paragraph", children: ["Wij verzamelen alleen wat nodig is."] },
    ]);

    const html = await editorStateToHtml(state);
    expect(html).toContain("<h2");
    expect(html).toContain("Welke gegevens");
    expect(html).toContain("<p");
    expect(html).toContain("Wij verzamelen alleen wat nodig is.");
  });

  it("supports links inside a paragraph", async () => {
    const state = editorStateFromBlocks([
      {
        type: "paragraph",
        children: [
          "Zie het ",
          {
            text: "privacy-addendum",
            href: "https://www.cloudflare.com/cloudflare-turnstile-privacy-addendum/",
          },
          " voor details.",
        ],
      },
    ]);

    const html = await editorStateToHtml(state);
    expect(html).toContain(
      'href="https://www.cloudflare.com/cloudflare-turnstile-privacy-addendum/"',
    );
    expect(html).toContain("privacy-addendum");
    expect(html).toContain("Zie het ");
  });

  it("produces a state with detectable text content", () => {
    const state = editorStateFromBlocks([
      { type: "paragraph", children: ["x"] },
    ]);
    expect(hasEditorText(state)).toBe(true);
  });
});
