/**
 * Slugs an owner-created page can never claim (ADR-0020): the existing
 * top-level static route segments — which would otherwise silently shadow a
 * page at the same URL — plus every locale code, since `/{locale}/{slug}`
 * shares its first segment with `/{locale}` itself.
 *
 * Every future top-level static route must be added here.
 */
export const RESERVED_SLUGS = [
  "admin",
  "api",
  "book",
  "poi",
  "documents",
  "privacy",
  "terms",
  "nl",
  "en",
  "fr",
  "de",
] as const;

const RESERVED_SLUG_SET = new Set<string>(RESERVED_SLUGS);

export function isReservedSlug(slug: string): boolean {
  return RESERVED_SLUG_SET.has(slug);
}
