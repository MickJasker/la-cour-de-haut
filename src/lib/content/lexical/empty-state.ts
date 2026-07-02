import type {
  SerializedEditorState,
  SerializedParagraphNode,
  SerializedRootNode,
} from "lexical";

/**
 * Serialized form of an empty Lexical editor (a single empty paragraph). Used
 * as the form default for `poi.detail.nl` and as the fallback when a locale has
 * no content. Kept as a plain constant so non-Lexical code (forms, schema
 * defaults) can use it without importing the editor runtime.
 */
const emptyParagraph: SerializedParagraphNode = {
  type: "paragraph",
  version: 1,
  children: [],
  direction: null,
  format: "",
  indent: 0,
  textFormat: 0,
  textStyle: "",
};

const root: SerializedRootNode = {
  type: "root",
  version: 1,
  children: [emptyParagraph],
  direction: null,
  format: "",
  indent: 0,
};

export const EMPTY_EDITOR_STATE: SerializedEditorState = { root };

type WalkNode = { type?: string; text?: string; children?: WalkNode[] };

/**
 * True when the serialized state contains at least one non-whitespace text
 * node. Used to decide whether a detail field actually has content (an editor
 * always serializes at least one empty paragraph). Pure walker — no Lexical
 * runtime, safe to import from client form code.
 */
export function hasEditorText(state: SerializedEditorState): boolean {
  const stack: WalkNode[] = [state.root as WalkNode];
  while (stack.length > 0) {
    const node = stack.pop();
    if (!node) continue;
    if (
      node.type === "text" &&
      typeof node.text === "string" &&
      node.text.trim().length > 0
    ) {
      return true;
    }
    if (Array.isArray(node.children)) stack.push(...node.children);
  }
  return false;
}
