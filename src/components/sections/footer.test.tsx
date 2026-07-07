import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import type { ReactNode } from "react";

// Footer is an async Server Component: awaiting it before act()-wrapped
// rendering (unlike the other, synchronous component tests in this repo)
// otherwise leaves React's act queue in a state that trips this warning.
declare global {
  var IS_REACT_ACT_ENVIRONMENT: boolean | undefined;
}
globalThis.IS_REACT_ACT_ENVIRONMENT = true;

const { getPublishedPageBySlugMock } = vi.hoisted(() => ({
  getPublishedPageBySlugMock: vi.fn(),
}));

vi.mock("@/lib/pages/page-queries", () => ({
  getPublishedPageBySlug: getPublishedPageBySlugMock,
}));

// The real Link resolves the active locale via next/navigation's router
// context, which isn't mounted under a bare react-dom render. Footer's own
// behavior under test is the legal-links degrade, not Link's locale
// prefixing, so stub it down to a plain anchor.
vi.mock("@/i18n/navigation", () => ({
  Link: ({ href, children }: { href: string; children: ReactNode }) => (
    <a href={href}>{children}</a>
  ),
}));

import { Footer } from "./footer";

function page(slug: string, titleNl: string) {
  return {
    id: slug,
    slug,
    title: { nl: titleNl },
    titleSource: { nl: "human" as const },
    body: { nl: titleNl },
    bodySource: { nl: "human" as const },
    published: true,
    system: true,
    createdAt: new Date(),
    updatedAt: new Date(),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any;
}

let container: HTMLDivElement | null = null;
let root: Root | null = null;

beforeEach(() => {
  getPublishedPageBySlugMock.mockReset();
  vi.spyOn(console, "error")
    .mockClear()
    .mockImplementation(() => {});
});

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

async function mountFooter() {
  const element = await Footer({ locale: "nl" });
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
  act(() => {
    root!.render(element);
  });
  return container;
}

describe("Footer", () => {
  it("renders both legal links when both lookups succeed", async () => {
    getPublishedPageBySlugMock.mockImplementation((slug: string) =>
      Promise.resolve(
        page(slug, slug === "privacy" ? "Privacy" : "Voorwaarden"),
      ),
    );

    const el = await mountFooter();

    expect(el.querySelector("nav[aria-label='Legal']")).not.toBeNull();
    expect(el.textContent).toContain("Privacy");
    expect(el.textContent).toContain("Voorwaarden");
    expect(console.error).not.toHaveBeenCalled();
  });

  it("degrades to omitting the affected link (not crashing) when one lookup rejects", async () => {
    getPublishedPageBySlugMock.mockImplementation((slug: string) => {
      if (slug === "privacy") {
        return Promise.reject(new Error("db unavailable"));
      }
      return Promise.resolve(page(slug, "Voorwaarden"));
    });

    const el = await mountFooter();

    expect(el.textContent).not.toContain("Privacy");
    expect(el.textContent).toContain("Voorwaarden");
    expect(console.error).toHaveBeenCalledWith(
      "Failed to load the privacy page",
      expect.any(Error),
    );
  });

  it("renders the footer without a legal nav (never throws) when both lookups reject", async () => {
    getPublishedPageBySlugMock.mockRejectedValue(new Error("db unavailable"));

    const el = await mountFooter();

    expect(el.querySelector("nav[aria-label='Legal']")).toBeNull();
    // The rest of the footer (address block) still renders.
    expect(el.querySelector("address")).not.toBeNull();
    expect(console.error).toHaveBeenCalledTimes(2);
  });
});
