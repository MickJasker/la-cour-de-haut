import { describe, it, expect } from "vitest";
import { RESERVED_SLUGS, isReservedSlug } from "./reserved-slugs";

describe("isReservedSlug", () => {
  it("flags existing top-level app segments", () => {
    for (const slug of [
      "admin",
      "api",
      "book",
      "poi",
      "documents",
      "privacy",
      "terms",
    ]) {
      expect(isReservedSlug(slug)).toBe(true);
    }
  });

  it("flags locale codes", () => {
    for (const locale of ["nl", "en", "fr", "de"]) {
      expect(isReservedSlug(locale)).toBe(true);
    }
  });

  it("allows an ordinary page slug", () => {
    expect(isReservedSlug("huisregels")).toBe(false);
  });

  it("exposes the full list for callers that need to enumerate it", () => {
    expect(RESERVED_SLUGS).toContain("admin");
    expect(RESERVED_SLUGS.length).toBeGreaterThan(0);
  });
});
