import { readdirSync } from "node:fs";
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

  // Derives the expectation from the real route tree, so adding a static
  // route without extending RESERVED_SLUGS fails here instead of silently
  // shadowing an owner page (the exact drift ADR-0020 warns about).
  it("covers every actual static route segment in src/app", () => {
    const routeDirs = (dir: string) =>
      readdirSync(dir, { withFileTypes: true })
        .filter((e) => e.isDirectory() && !/^[[@(_]/.test(e.name))
        .map((e) => e.name);

    const topLevel = routeDirs("src/app");
    const underLocale = routeDirs("src/app/[locale]");
    // File-convention metadata routes claim URL segments as well.
    const metadataRoutes = readdirSync("src/app/[locale]")
      .filter((f) => /^(opengraph-image|twitter-image)\./.test(f))
      .map((f) => f.split(".")[0]);

    for (const segment of [...topLevel, ...underLocale, ...metadataRoutes]) {
      expect(isReservedSlug(segment), `"${segment}" must be reserved`).toBe(
        true,
      );
    }
  });
});
