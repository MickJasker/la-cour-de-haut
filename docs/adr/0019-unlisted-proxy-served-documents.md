# ADR-0019: Unlisted, proxy-served document links

**Status:** Accepted

## Context

The owner wants to share PDF documents (house rules, arrival instructions, …) with guests. Requirements settled during the design interview: documents are **unlisted-public** — nothing on the public site lists them; the owner pastes a link into an email (e.g. alongside the bank-transfer instructions). A document is a single PDF for all locales with a plain-text admin-only title; replacing the PDF must not change the link already sitting in guests' inboxes.

The PDFs live in Vercel Blob like all other binary assets (see CONTEXT.md "Media storage"). That leaves the question of what URL the owner actually shares.

## Decision

Each document gets a slug (from the existing `slugify`, deduped, stable-after-create) and a first-party streaming route:

```
GET /documents/{slug}.pdf
```

The handler looks up the document by slug at request time and **streams** the current blob body (`Content-Type: application/pdf`, `Content-Disposition: inline`, `Cache-Control: no-store`) — never a redirect. Replace-in-place swaps the `fileUrl` behind the same slug (old blob deleted best-effort, like the POI hero-image swap); deleting the document makes the link 404.

Options rejected:

- **Raw Blob URLs in emails** — a replace mints a new blob URL, so every previously shared link keeps serving the outdated file (or dies once the old blob is deleted), and the links expose the storage vendor's domain.
- **302 redirect to the blob URL** — the browser lands on `blob.vercel-storage.com`, so anything a guest copies or bookmarks from the address bar is a blob URL that dies on the next replace.

Supporting decisions:

- The `.pdf` suffix lives inside the single `[slug]` route segment, mirroring `/api/ical/[token].ics`.
- `src/proxy.ts`'s matcher now excludes `.pdf` paths — without this the locale middleware redirects `/documents/x.pdf` to `/nl/documents/x.pdf` → 404 (same bug class ADR-0011 fixed for `sitemap.xml`).
- The slug derives from the plain title directly — a deliberate deviation from ADR-0015's translate-to-English slug, since the title is an admin-only label with no public listing.
- Dedicated `document` table rather than `setting` keys, per the ADR-0007 precedent for multi-valued first-class records.

## Consequences

- Every link ever shared stays live and always serves the current file; the blob URL never appears in a guest-visible place.
- No caching anywhere on the route: the request-time DB read plus `no-store` means replace and delete take effect on the next request.
- Slugs are guessable ("huisregels") — accepted: unlisted is a courtesy, not a security boundary; the documents are non-sensitive by definition.
- Download bytes transit a Vercel function (response streaming, no buffering). At gîte traffic this is negligible; revisit only if documents grow beyond the 20 MB upload cap or traffic changes character.
- The upload token route's content-type allowlist is now folder-scoped (`documents/` → `application/pdf`, everything else → `image/*`).
