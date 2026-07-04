/**
 * Trim a plain-text string to a meta-description-friendly length.
 *
 * Search engines display ~155–160 chars of a description before truncating
 * mid-word with an ellipsis. Feeding the full body (which can be a whole
 * paragraph) wastes that budget and reads as a cut-off wall of text, so we
 * truncate ourselves at a word boundary and append a single ellipsis.
 *
 * Collapses internal whitespace/newlines first so a multi-line body doesn't
 * leave odd gaps in the tag.
 */
export function truncateForMeta(text: string, max = 155): string {
  const collapsed = text.replace(/\s+/g, " ").trim();
  if (collapsed.length <= max) return collapsed;
  // Cut at the last space within budget so we never split a word.
  const slice = collapsed.slice(0, max);
  const lastSpace = slice.lastIndexOf(" ");
  return `${slice.slice(0, lastSpace > 0 ? lastSpace : max).trimEnd()}…`;
}
