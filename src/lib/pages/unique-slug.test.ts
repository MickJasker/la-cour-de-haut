import { describe, it, expect } from "vitest";
import { uniquePageSlugFrom } from "./unique-slug";

describe("uniquePageSlugFrom", () => {
  it("returns the base when free", () => {
    expect(uniquePageSlugFrom("huisregels", new Set())).toBe("huisregels");
  });

  it("appends -2, -3, … on collision with existing slugs", () => {
    const taken = new Set(["huisregels", "huisregels-2"]);
    expect(uniquePageSlugFrom("huisregels", taken)).toBe("huisregels-3");
  });

  it("skips reserved slugs instead of claiming them", () => {
    expect(uniquePageSlugFrom("poi", new Set())).toBe("poi-2");
    expect(uniquePageSlugFrom("opengraph-image", new Set())).toBe(
      "opengraph-image-2",
    );
  });

  it("falls back to 'pagina' for an empty base", () => {
    expect(uniquePageSlugFrom("", new Set())).toBe("pagina");
    expect(uniquePageSlugFrom("", new Set(["pagina"]))).toBe("pagina-2");
  });
});
