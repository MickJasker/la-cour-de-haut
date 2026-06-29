/**
 * True only for link hrefs we consider safe to render/store: http, https, and
 * mailto. Everything else (notably javascript:, data:, vbscript:) is rejected.
 * Shared by the public renderer (read-time guard) and the editor (write-time
 * guard) so the two can't drift. See ADR-0015.
 */
export function isSafeHref(url: string): boolean {
  try {
    // The base lets relative URLs resolve to an http(s) origin.
    const { protocol } = new URL(url, "https://x.invalid");
    return (
      protocol === "http:" || protocol === "https:" || protocol === "mailto:"
    );
  } catch {
    return false;
  }
}
