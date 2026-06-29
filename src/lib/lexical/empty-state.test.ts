import { describe, it, expect } from "vitest";
import type { SerializedEditorState } from "lexical";
import { EMPTY_EDITOR_STATE, hasEditorText } from "./empty-state";

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

function textNode(text: string): SerializedNode {
  return { type: "text", text, format: 0, version: 1 } as SerializedNode;
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

describe("hasEditorText", () => {
  it("is false for the empty editor state", () => {
    expect(hasEditorText(EMPTY_EDITOR_STATE)).toBe(false);
  });

  it("is false when paragraphs contain only whitespace", () => {
    expect(hasEditorText(makeState(paragraphNode(textNode("   "))))).toBe(
      false,
    );
  });

  it("is true when any text node has non-whitespace content", () => {
    expect(hasEditorText(makeState(paragraphNode(textNode("Hallo"))))).toBe(
      true,
    );
  });

  it("finds text nested inside non-paragraph blocks", () => {
    expect(hasEditorText(makeState(headingNode("h2", textNode("Titel"))))).toBe(
      true,
    );
  });
});
