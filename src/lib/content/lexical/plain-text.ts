import type { SerializedEditorState } from "lexical";

type WalkNode = { type?: string; text?: string; children?: WalkNode[] };

function inlineText(node: WalkNode): string {
  if (node.type === "text" && typeof node.text === "string") return node.text;
  if (node.type === "linebreak") return " ";
  if (Array.isArray(node.children)) {
    return node.children.map(inlineText).join("");
  }
  return "";
}

/**
 * Flatten a serialized Lexical EditorState to plain text: inline content is
 * concatenated verbatim, top-level blocks are joined with a single space so
 * a heading never glues onto the following paragraph. Pure walker — no
 * Lexical runtime (same approach as `hasEditorText`). Used to derive a
 * page's meta description from its body (ADR-0020: no separate field).
 */
export function editorStateToPlainText(state: SerializedEditorState): string {
  const blocks = (state.root as WalkNode).children ?? [];
  return blocks
    .map((block) => inlineText(block).trim())
    .filter((text) => text.length > 0)
    .join(" ");
}
