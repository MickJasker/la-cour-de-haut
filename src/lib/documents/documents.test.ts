import { describe, it, expect } from "vitest";
import { uniqueSlugFrom } from "./documents";

describe("uniqueSlugFrom", () => {
  it("returns the base when it isn't taken", () => {
    expect(uniqueSlugFrom("house-rules", new Set(), "document")).toBe(
      "house-rules",
    );
  });

  it("appends -2 when the base is already taken", () => {
    expect(
      uniqueSlugFrom("house-rules", new Set(["house-rules"]), "document"),
    ).toBe("house-rules-2");
  });

  it("appends -3 when the base and -2 are both taken", () => {
    expect(
      uniqueSlugFrom(
        "house-rules",
        new Set(["house-rules", "house-rules-2"]),
        "document",
      ),
    ).toBe("house-rules-3");
  });

  it("falls back to the fallback root when the base is empty", () => {
    expect(uniqueSlugFrom("", new Set(), "document")).toBe("document");
  });
});
