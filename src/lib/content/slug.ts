/**
 * Convert arbitrary text into a URL-safe slug: lowercased, diacritics stripped
 * to plain ASCII, runs of non-alphanumeric characters collapsed to single
 * hyphens, and leading/trailing hyphens trimmed.
 *
 * May return an empty string when the input has no slug-worthy characters
 * (e.g. "!!!"); callers should fall back to a sensible default in that case.
 */
export function slugify(input: string): string {
  return input
    .normalize("NFKD") // decompose accented letters into base + combining mark
    .replace(/\p{Mn}/gu, "") // strip the nonspacing combining marks
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}
