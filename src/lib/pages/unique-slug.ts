import { isReservedSlug } from "./reserved-slugs";

/**
 * Picks a free slug from a slugified base: skips slugs already taken by
 * other pages AND the reserved-slug blocklist (ADR-0020) by appending `-2`,
 * `-3`, …. Falls back to "pagina" when the base is empty (the title had no
 * slug-worthy characters). Pure — the caller fetches the taken set
 * (mirrors `uniqueSlugFrom` in the documents lib).
 */
export function uniquePageSlugFrom(
  base: string,
  taken: ReadonlySet<string>,
): string {
  const root = base || "pagina";
  const isFree = (candidate: string) =>
    !taken.has(candidate) && !isReservedSlug(candidate);

  if (isFree(root)) return root;
  let n = 2;
  while (!isFree(`${root}-${n}`)) n++;
  return `${root}-${n}`;
}
