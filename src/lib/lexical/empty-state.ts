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
