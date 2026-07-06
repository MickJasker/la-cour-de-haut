import { describe, it, expect, afterEach } from "vitest";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import type { SerializedEditorState } from "lexical";
import { GeneralInfoDialog } from "./general-info-dialog";

// ---------------------------------------------------------------------------
// Helpers (mirrors rich-text-renderer.test.tsx's node builders)
// ---------------------------------------------------------------------------

type SerializedNode = SerializedEditorState["root"]["children"][number];

function makeState(text: string): SerializedEditorState {
  const textNode = {
    type: "text",
    text,
    format: 0,
    version: 1,
  } as SerializedNode;

  const paragraphNode = {
    type: "paragraph",
    children: [textNode],
    version: 1,
    direction: null,
    format: "",
    indent: 0,
  } as SerializedNode;

  return {
    root: {
      type: "root",
      version: 1,
      children: [paragraphNode],
      direction: null,
      format: "",
      indent: 0,
    },
  };
}

let container: HTMLDivElement | null = null;
let root: Root | null = null;

afterEach(() => {
  if (root) {
    act(() => root!.unmount());
    root = null;
  }
  if (container) {
    container.remove();
    container = null;
  }
});

function mount(ui: React.ReactElement) {
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
  act(() => {
    root!.render(ui);
  });
  return container;
}

// ---------------------------------------------------------------------------
// Behavior: dialog is closed by default, opens on trigger click, and renders
// the (already-localized) title + rich text content passed from the server
// component (GiteSection) — mirrors GiteDialog's open/close pattern.
// ---------------------------------------------------------------------------

describe("GeneralInfoDialog", () => {
  it("does not render the dialog title or body content before the trigger is clicked", () => {
    mount(
      <GeneralInfoDialog
        title="Algemene informatie"
        state={makeState("Belangrijke praktische info")}
      >
        Algemene informatie
      </GeneralInfoDialog>,
    );

    // The trigger button itself carries the label, so assert on the dialog
    // role rather than the raw text, which the button also contains.
    expect(document.body.querySelector("[role='dialog']")).toBeNull();
    expect(document.body.textContent).not.toContain(
      "Belangrijke praktische info",
    );
  });

  it("shows the title and rich text body once the trigger button is clicked", () => {
    mount(
      <GeneralInfoDialog
        title="Algemene informatie"
        state={makeState("Belangrijke praktische info")}
      >
        Algemene informatie
      </GeneralInfoDialog>,
    );

    const trigger = container!.querySelector("button")!;
    act(() => {
      trigger.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    const dialog = document.body.querySelector("[role='dialog']");
    expect(dialog).not.toBeNull();
    expect(dialog!.textContent).toContain("Algemene informatie");
    expect(dialog!.textContent).toContain("Belangrijke praktische info");
  });
});
