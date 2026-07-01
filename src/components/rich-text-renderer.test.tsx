import { describe, it, expect } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { RichTextRenderer } from "./rich-text-renderer";
import type { SerializedEditorState } from "lexical";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

type SerializedNode = SerializedEditorState["root"]["children"][number];

function makeState(...children: SerializedNode[]): SerializedEditorState {
  return {
    root: {
      type: "root",
      version: 1,
      children,
      direction: null,
      format: "",
      indent: 0,
    },
  };
}

function textNode(text: string, format = 0): SerializedNode {
  return { type: "text", text, format, version: 1 } as SerializedNode;
}

function paragraphNode(...children: SerializedNode[]): SerializedNode {
  return {
    type: "paragraph",
    children,
    version: 1,
    direction: null,
    format: "",
    indent: 0,
  } as SerializedNode;
}

function headingNode(
  tag: string,
  ...children: SerializedNode[]
): SerializedNode {
  return {
    type: "heading",
    tag,
    children,
    version: 1,
    direction: null,
    format: "",
    indent: 0,
  } as SerializedNode;
}

function listNode(
  listType: "bullet" | "number" | "check",
  ...children: SerializedNode[]
): SerializedNode {
  return {
    type: "list",
    listType,
    tag: listType === "number" ? "ol" : "ul",
    children,
    version: 1,
    direction: null,
    format: "",
    indent: 0,
  } as SerializedNode;
}

function listItemNode(...children: SerializedNode[]): SerializedNode {
  return {
    type: "listitem",
    children,
    version: 1,
    direction: null,
    format: "",
    indent: 0,
    value: 1,
    checked: undefined,
  } as SerializedNode;
}

function linkNode(url: string, ...children: SerializedNode[]): SerializedNode {
  return {
    type: "link",
    url,
    children,
    version: 1,
    direction: null,
    format: "",
    indent: 0,
    rel: null,
    target: null,
    title: null,
  } as SerializedNode;
}

// ---------------------------------------------------------------------------
// Behavior 1: paragraph with plain text
// ---------------------------------------------------------------------------

describe("RichTextRenderer", () => {
  describe("paragraph", () => {
    it("renders plain text inside a <p>", () => {
      const html = renderToStaticMarkup(
        <RichTextRenderer
          state={makeState(paragraphNode(textNode("Hello")))}
        />,
      );
      expect(html).toContain("<p");
      expect(html).toContain("Hello");
    });
  });

  // -------------------------------------------------------------------------
  // Behavior 7: unknown node type is skipped without throwing
  // -------------------------------------------------------------------------

  describe("unknown node type", () => {
    it("skips unknown node types without throwing", () => {
      const unknownNode = {
        type: "custom-widget",
        version: 1,
        children: [],
      } as unknown as Parameters<typeof makeState>[0];

      expect(() => {
        renderToStaticMarkup(
          <RichTextRenderer
            state={makeState(
              unknownNode,
              paragraphNode(textNode("Still visible")),
            )}
          />,
        );
      }).not.toThrow();

      const html = renderToStaticMarkup(
        <RichTextRenderer
          state={makeState(
            unknownNode,
            paragraphNode(textNode("Still visible")),
          )}
        />,
      );
      // The unknown node produces no output; the paragraph that follows still renders
      expect(html).toContain("Still visible");
    });
  });

  // -------------------------------------------------------------------------
  // Behavior 6: unsafe link (javascript:)
  // -------------------------------------------------------------------------

  describe("unsafe links", () => {
    it("does not render an <a> for javascript: URLs but still renders link text", () => {
      const html = renderToStaticMarkup(
        <RichTextRenderer
          state={makeState(
            paragraphNode(linkNode("javascript:alert(1)", textNode("Click"))),
          )}
        />,
      );
      expect(html).not.toContain("<a");
      expect(html).not.toContain("href");
      expect(html).not.toContain("<script");
      expect(html).toContain("Click");
    });
  });

  // -------------------------------------------------------------------------
  // Behavior 5: safe links
  // -------------------------------------------------------------------------

  describe("safe links", () => {
    it("renders https link as <a> with rel=noopener noreferrer and target=_blank", () => {
      const html = renderToStaticMarkup(
        <RichTextRenderer
          state={makeState(
            paragraphNode(
              linkNode("https://example.com", textNode("Click me")),
            ),
          )}
        />,
      );
      expect(html).toContain('href="https://example.com"');
      expect(html).toContain('rel="noopener noreferrer"');
      expect(html).toContain('target="_blank"');
      expect(html).toContain("Click me");
    });

    it("renders mailto link as <a> without target or rel", () => {
      const html = renderToStaticMarkup(
        <RichTextRenderer
          state={makeState(
            paragraphNode(
              linkNode("mailto:hello@example.com", textNode("Email us")),
            ),
          )}
        />,
      );
      expect(html).toContain('href="mailto:hello@example.com"');
      expect(html).toContain("Email us");
      // mailto links must NOT have target="_blank"
      expect(html).not.toContain('target="_blank"');
    });
  });

  // -------------------------------------------------------------------------
  // Behavior 4: lists
  // -------------------------------------------------------------------------

  describe("lists", () => {
    it("renders bullet list as <ul> with <li>", () => {
      const html = renderToStaticMarkup(
        <RichTextRenderer
          state={makeState(
            listNode("bullet", listItemNode(textNode("Item 1"))),
          )}
        />,
      );
      expect(html).toContain("<ul");
      expect(html).toContain("<li");
      expect(html).toContain("Item 1");
    });

    it("renders numbered list as <ol> with <li>", () => {
      const html = renderToStaticMarkup(
        <RichTextRenderer
          state={makeState(
            listNode("number", listItemNode(textNode("Item 2"))),
          )}
        />,
      );
      expect(html).toContain("<ol");
      expect(html).toContain("<li");
      expect(html).toContain("Item 2");
    });
  });

  // -------------------------------------------------------------------------
  // Behavior 3: text formatting
  // -------------------------------------------------------------------------

  describe("text formatting", () => {
    it("wraps bold text (format & 1) in <strong>", () => {
      const html = renderToStaticMarkup(
        <RichTextRenderer
          state={makeState(paragraphNode(textNode("Bold", 1)))}
        />,
      );
      expect(html).toContain("<strong>");
      expect(html).toContain("Bold");
    });

    it("wraps italic text (format & 2) in <em>", () => {
      const html = renderToStaticMarkup(
        <RichTextRenderer
          state={makeState(paragraphNode(textNode("Italic", 2)))}
        />,
      );
      expect(html).toContain("<em>");
      expect(html).toContain("Italic");
    });

    it("nests bold+italic as <strong><em>", () => {
      const html = renderToStaticMarkup(
        <RichTextRenderer
          state={makeState(paragraphNode(textNode("BoldItalic", 3)))}
        />,
      );
      expect(html).toContain("<strong><em>");
      expect(html).toContain("BoldItalic");
    });

    it("wraps underline text (format & 8) in <u>", () => {
      // Cmd+U is reachable in the editor even without a toolbar button.
      const html = renderToStaticMarkup(
        <RichTextRenderer
          state={makeState(paragraphNode(textNode("Underlined", 8)))}
        />,
      );
      expect(html).toContain("<u>");
      expect(html).toContain("Underlined");
    });
  });

  // -------------------------------------------------------------------------
  // Line breaks (Shift+Enter inserts a LineBreakNode)
  // -------------------------------------------------------------------------

  describe("line breaks", () => {
    it("renders a linebreak node as <br>", () => {
      const lineBreak = { type: "linebreak", version: 1 } as SerializedNode;
      const html = renderToStaticMarkup(
        <RichTextRenderer
          state={makeState(
            paragraphNode(textNode("Line 1"), lineBreak, textNode("Line 2")),
          )}
        />,
      );
      expect(html).toContain("<br");
      expect(html).toContain("Line 1");
      expect(html).toContain("Line 2");
    });
  });

  // -------------------------------------------------------------------------
  // Behavior 2: headings
  // -------------------------------------------------------------------------

  describe("headings", () => {
    it("renders h2 for tag='h2'", () => {
      const html = renderToStaticMarkup(
        <RichTextRenderer
          state={makeState(headingNode("h2", textNode("Section")))}
        />,
      );
      expect(html).toContain("<h2");
      expect(html).toContain("Section");
    });

    it("renders h3 for tag='h3'", () => {
      const html = renderToStaticMarkup(
        <RichTextRenderer
          state={makeState(headingNode("h3", textNode("Sub")))}
        />,
      );
      expect(html).toContain("<h3");
    });

    it("clamps an unknown heading tag to h3", () => {
      const html = renderToStaticMarkup(
        <RichTextRenderer
          state={makeState(headingNode("h1", textNode("Title")))}
        />,
      );
      expect(html).not.toContain("<h1");
      expect(html).toContain("<h3");
      expect(html).toContain("Title");
    });
  });

  // -------------------------------------------------------------------------
  // Behavior 8: className override (ADR-0017 — hero/gîte reuse font styling)
  // -------------------------------------------------------------------------

  describe("className override", () => {
    it("uses the default container class when no className is given", () => {
      const html = renderToStaticMarkup(
        <RichTextRenderer state={makeState(paragraphNode(textNode("Hi")))} />,
      );
      expect(html).toContain("max-w-prose");
    });

    it("replaces the container class when className is given", () => {
      const html = renderToStaticMarkup(
        <RichTextRenderer
          state={makeState(paragraphNode(textNode("Hi")))}
          className="text-style-body-large"
        />,
      );
      expect(html).not.toContain("max-w-prose");
      expect(html).toContain("text-style-body-large");
    });
  });
});
