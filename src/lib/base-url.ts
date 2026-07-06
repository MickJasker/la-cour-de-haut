/**
 * The site is served from multiple domains (all configured on the Vercel
 * project), but SEO metadata, sitemaps, and emails must always point at the
 * canonical origin. Request-origin concerns (auth) accept every public host.
 */
export const CANONICAL_ORIGIN = "https://lacourdehaut.fr";

/** Every host the production site is served from. */
export const PUBLIC_HOSTS = [
  "lacourdehaut.fr",
  "www.lacourdehaut.fr",
  "la-cour-de-haut.vercel.app",
] as const;

/**
 * Canonical base URL for absolute links (metadata, sitemap, emails).
 * Read at call time so tests and preview deployments can override via env.
 */
export function getBaseUrl(): string {
  return process.env.NEXT_PUBLIC_APP_URL ?? CANONICAL_ORIGIN;
}
