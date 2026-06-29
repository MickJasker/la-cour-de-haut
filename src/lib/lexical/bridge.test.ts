import { describe, it, expect } from "vitest";
import { editorStateToHtml, htmlToEditorState } from "./bridge";

// The bridge is exercised through its public pair: import HTML -> EditorState,
// export EditorState -> HTML. Tests run in jsdom (ambient DOM), so the lazy
// happy-dom path is not exercised here. Round-tripping our own minimal node set
// is the contract that matters.

async function roundTrip(html: string): Promise<string> {
  return editorStateToHtml(await htmlToEditorState(html));
}

describe("lexical bridge", () => {
  it("preserves headings and paragraph text", async () => {
    const out = await roundTrip("<h2>Bayeux</h2><p>Hello world</p>");
    expect(out).toContain("<h2");
    expect(out).toContain("Bayeux");
    expect(out).toContain("<p");
    expect(out).toContain("Hello world");
  });

  it("preserves bold and italic inline formatting", async () => {
    const out = await roundTrip(
      "<p>plain <strong>bold</strong> and <em>italic</em></p>",
    );
    expect(out).toContain("<strong");
    expect(out).toContain("bold");
    expect(out).toContain("<em");
    expect(out).toContain("italic");
  });

  it("preserves bullet and numbered lists", async () => {
    const bullet = await roundTrip("<ul><li>one</li><li>two</li></ul>");
    expect(bullet).toContain("<ul");
    expect(bullet.match(/<li/g)?.length).toBe(2);

    const numbered = await roundTrip("<ol><li>first</li></ol>");
    expect(numbered).toContain("<ol");
  });

  it("preserves links with their href", async () => {
    const out = await roundTrip(
      '<p>see <a href="https://example.com">the site</a></p>',
    );
    expect(out).toContain('href="https://example.com"');
    expect(out).toContain("the site");
  });

  it("is idempotent after the first normalization", async () => {
    const html = "<h2>Title</h2><p>Body <strong>x</strong></p>";
    const once = await roundTrip(html);
    const twice = await roundTrip(once);
    expect(twice).toBe(once);
  });
});
