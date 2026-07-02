import { describe, it, expect } from "vitest";
import type { SerializedEditorState } from "lexical";
import { EMPTY_EDITOR_STATE } from "./empty-state";
import { parseDetailField } from "./parse-detail-field";

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

function formDataWith(detail: unknown): FormData {
  const fd = new FormData();
  fd.set("detail", JSON.stringify(detail));
  return fd;
}

const nonEmptyState = makeState(paragraphNode(textNode("Hallo")));

describe("parseDetailField", () => {
  it("returns null when the field is absent", () => {
    expect(parseDetailField(new FormData())).toBeNull();
  });

  it("returns null when the field is not a string", () => {
    const fd = new FormData();
    fd.set("detail", new Blob(["not a string"]));
    expect(parseDetailField(fd)).toBeNull();
  });

  it("returns null when the field is malformed JSON", () => {
    const fd = new FormData();
    fd.set("detail", "{not json");
    expect(parseDetailField(fd)).toBeNull();
  });

  it("returns null when the parsed value fails schema validation", () => {
    expect(
      parseDetailField(formDataWith({ nl: "not an editor state" })),
    ).toBeNull();
  });

  it("returns null when nl has no real text content (the empty-detail rule)", () => {
    expect(
      parseDetailField(formDataWith({ nl: EMPTY_EDITOR_STATE })),
    ).toBeNull();
  });

  it("parses the localized { nl, en?, fr?, de? } wire format when nl has real text", () => {
    const result = parseDetailField(
      formDataWith({ nl: nonEmptyState, en: nonEmptyState }),
    );
    expect(result).not.toBeNull();
    expect(result?.nl).toEqual(nonEmptyState);
    expect(result?.en).toEqual(nonEmptyState);
    expect(result?.fr).toBeUndefined();
  });
});
