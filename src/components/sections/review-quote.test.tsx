import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { ReviewQuote } from "./review-quote";

// jsdom has no ResizeObserver implementation; stub a no-op one so the ref
// callback in ReviewQuote doesn't throw when it wires one up. The tests below
// don't rely on the observer actually firing — they stub scrollHeight /
// clientHeight up front so the *initial* synchronous measurement (which the
// component always runs on mount, before ever touching the observer) already
// reflects the overflow state under test.
class FakeResizeObserver {
  observe() {}
  disconnect() {}
}

let container: HTMLDivElement;
let root: Root;

function renderQuote(props: {
  body: string;
  expandLabel?: string;
  collapseLabel?: string;
}) {
  act(() => {
    root.render(
      <ReviewQuote
        body={props.body}
        expandLabel={props.expandLabel ?? "Lees meer"}
        collapseLabel={props.collapseLabel ?? "Toon minder"}
      />,
    );
  });
}

/** Stub scrollHeight/clientHeight on every HTMLElement for this test run. */
function stubHeights(scrollHeight: number, clientHeight: number) {
  Object.defineProperty(HTMLElement.prototype, "scrollHeight", {
    configurable: true,
    value: scrollHeight,
  });
  Object.defineProperty(HTMLElement.prototype, "clientHeight", {
    configurable: true,
    value: clientHeight,
  });
}

beforeEach(() => {
  vi.stubGlobal("ResizeObserver", FakeResizeObserver);
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => {
    root.unmount();
  });
  container.remove();
  vi.unstubAllGlobals();
  // Restore the real (jsdom default) descriptors so other test files aren't
  // affected by this file's global HTMLElement.prototype stubbing.
  delete (HTMLElement.prototype as { scrollHeight?: unknown }).scrollHeight;
  delete (HTMLElement.prototype as { clientHeight?: unknown }).clientHeight;
});

describe("ReviewQuote", () => {
  describe("overflowing text (scrollHeight > clientHeight)", () => {
    it("shows the expand control and toggles the quote open and closed", () => {
      stubHeights(120, 60);
      renderQuote({ body: "A very long review that overflows the clamp." });

      const button = container.querySelector("button");
      expect(button).not.toBeNull();
      expect(button!.textContent).toBe("Lees meer");
      expect(button!.getAttribute("aria-expanded")).toBe("false");

      const blockquote = container.querySelector("blockquote")!;
      expect(blockquote.className).toContain("line-clamp-3");

      act(() => {
        button!.click();
      });

      const buttonAfterExpand = container.querySelector("button")!;
      expect(buttonAfterExpand.textContent).toBe("Toon minder");
      expect(buttonAfterExpand.getAttribute("aria-expanded")).toBe("true");
      expect(container.querySelector("blockquote")!.className).not.toContain(
        "line-clamp-3",
      );

      act(() => {
        buttonAfterExpand.click();
      });

      const buttonAfterCollapse = container.querySelector("button")!;
      expect(buttonAfterCollapse.textContent).toBe("Lees meer");
      expect(container.querySelector("blockquote")!.className).toContain(
        "line-clamp-3",
      );
    });
  });

  describe("non-overflowing text (scrollHeight === clientHeight)", () => {
    it("renders no expand control", () => {
      stubHeights(60, 60);
      renderQuote({ body: "Short review." });

      expect(container.querySelector("button")).toBeNull();
      const blockquote = container.querySelector("blockquote")!;
      expect(blockquote.className).toContain("line-clamp-3");
      expect(blockquote.textContent).toBe("“Short review.”");
    });
  });
});
