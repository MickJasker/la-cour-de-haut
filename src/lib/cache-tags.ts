/**
 * Single source of truth for the `"use cache"` tags this app invalidates on
 * save (ADR-0016). Each tag is read in exactly one place via `cacheTag()`
 * and written in exactly one place via `updateTag()`; importing the same
 * constant on both sides means a typo can no longer desync a save action
 * from the read site it's supposed to invalidate — a mismatch there would
 * silently keep serving stale content with no error.
 *
 * `reviews` is included even though the review save flow stays outside the
 * shared authored-save pipeline (`src/lib/authored-save.ts`) — quoted
 * content translates from the guest's original locale, not Dutch (see
 * ADR-0014) — because the read/write tag-string duplication this module
 * fixes applies to it just the same.
 */
export const CACHE_TAGS = {
  poi: "poi",
  content: "content",
  gallery: "gallery",
  reviews: "reviews",
  pages: "pages",
} as const;

export type CacheTag = (typeof CACHE_TAGS)[keyof typeof CACHE_TAGS];
