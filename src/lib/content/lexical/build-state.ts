import type {
  SerializedEditorState,
  SerializedLexicalNode,
  SerializedParagraphNode,
  SerializedRootNode,
  SerializedTextNode,
} from "lexical";
import type { SerializedHeadingNode } from "@lexical/rich-text";
import type { SerializedLinkNode } from "@lexical/link";

/**
 * An inline run inside a paragraph: plain text, or a link wrapping text.
 */
export type InlineContent = string | { text: string; href: string };

/**
 * A block in a hand-authored document. Deliberately covers only what seed
 * scripts need (h2 headings, paragraphs, inline links) — owner-authored
 * content is built in the Lexical editor, never through this.
 */
export type ContentBlockInput =
  | { type: "heading"; text: string }
  | { type: "paragraph"; children: InlineContent[] };

function textNode(text: string): SerializedTextNode {
  return {
    type: "text",
    version: 1,
    text,
    detail: 0,
    format: 0,
    mode: "normal",
    style: "",
  };
}

function inlineNode(inline: InlineContent): SerializedLexicalNode {
  if (typeof inline === "string") return textNode(inline);
  const link: SerializedLinkNode = {
    type: "link",
    version: 1,
    url: inline.href,
    rel: null,
    target: null,
    title: null,
    children: [textNode(inline.text)],
    direction: null,
    format: "",
    indent: 0,
  };
  return link;
}

/**
 * Build a serialized Lexical EditorState from plain block descriptions,
 * without the Lexical runtime (type-only imports). Used by seed scripts,
 * which cannot import the rich-text bridge: `bridge.ts` is `server-only`,
 * an alias only Next's bundler resolves.
 */
export function editorStateFromBlocks(
  blocks: ContentBlockInput[],
): SerializedEditorState {
  const children = blocks.map((block): SerializedLexicalNode => {
    if (block.type === "heading") {
      const heading: SerializedHeadingNode = {
        type: "heading",
        version: 1,
        tag: "h2",
        children: [textNode(block.text)],
        direction: null,
        format: "",
        indent: 0,
      };
      return heading;
    }
    const paragraph: SerializedParagraphNode = {
      type: "paragraph",
      version: 1,
      children: block.children.map(inlineNode),
      direction: null,
      format: "",
      indent: 0,
      textFormat: 0,
      textStyle: "",
    };
    return paragraph;
  });

  const root: SerializedRootNode = {
    type: "root",
    version: 1,
    children,
    direction: null,
    format: "",
    indent: 0,
  };
  return { root };
}
