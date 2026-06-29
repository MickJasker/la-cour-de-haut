import { describe, it, expect } from "vitest";
import { slugify } from "./slug";

describe("slugify", () => {
  it("lowercases and joins words with hyphens", () => {
    expect(slugify("The Beach")).toBe("the-beach");
  });

  it("strips diacritics to plain ASCII", () => {
    expect(slugify("Café René")).toBe("cafe-rene");
  });

  it("collapses punctuation runs and trims leading/trailing separators", () => {
    expect(slugify("  Saint-Lô!! ")).toBe("saint-lo");
  });

  it("returns an empty string when nothing slug-worthy remains", () => {
    expect(slugify("!!!")).toBe("");
  });
});
