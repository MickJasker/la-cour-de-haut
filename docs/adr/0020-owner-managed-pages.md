# ADR-0020: Owner-managed pages replace hardcoded legal routes

**Status:** Accepted

## Context

The privacy policy lived in the UI-chrome layer: a hardcoded route (`/[locale]/privacy`) rendering strings from `messages/{locale}.json` (per ADR-0008). The client now wants a terms-and-conditions page **and** the ability to edit legal text herself, without a developer or deploy in the loop. That requirement moves legal copy across the chrome/dynamic-content boundary into owner-managed, DB-stored content.

Settled during the design interview (2026-07-06): this is a true **page builder** — the owner can create, edit, and delete simple pages in the backoffice — not merely a fixed set of editable legal pages.

## Decision

A new first-class **Page** entity, managed in `/admin`, served at top-level `/{locale}/{slug}`.

- **Anatomy: title + one Lexical rich-text body per locale.** Reuses the ADR-0015 stack wholesale: the admin Lexical editor, the public EditorState→HTML walker, and the rich-text bridge. Not a block/layout builder.
- **Translation:** authored content per ADR-0016 — Dutch is the human source; EN/FR/DE are machine-filled on save (`text/html` through the bridge).
- **Slug: POI pattern (ADR-0015).** Auto-derived from the English translation of the Dutch title at creation, then frozen; no slug field in admin. Creation validates against a **reserved-slug blocklist** (existing static segments: `poi`, `admin`, `api`, `documents`, the locales, …) because pages share the top-level URL namespace with real routes, and Next's static segments would silently shadow a colliding page.
- **System pages:** seeded pages carry a `system` flag — editable, **undeletable, always published**, slug pinned at seed time (not auto-derived). This invariant is what lets hardcoded UI (the booking form's GDPR notice, the footer) link to them with no 404 risk. Two system pages: `privacy` and `terms`.
- **Lifecycle for owner-created pages:** deletable; `published` boolean, **draft by default** (gallery precedent, unlike live-on-create POIs — pages claim top-level, sitemap-visible URLs). Unpublished pages 404 publicly and stay out of the sitemap.
- **Discovery:** the footer gains a legal-links row hardcoded to the two system pages. Owner-created pages are **unlisted** (ADR-0019 precedent) — no automatic navigation; shared by URL — but do appear in the sitemap once published.
- **Metadata:** `<title>` from the page title; meta description **auto-excerpted from the body** (no separate description field); canonical/hreflang alternates as the hardcoded page had.

### Migration

- **Privacy migrates in** at its exact URL: seeded from the current 4-locale message-file copy, the hardcoded route and its message-file namespace deleted. One system renders all simple pages; no owner-facing asymmetry.
- Seeded EN/FR/DE slots are marked **`machine`** even though the current copy is hand-written — preserving the ADR-0016 invariant that no target locale is ever `human`. The first Dutch edit overwrites them with Google output; accepted, because silent locale desync on a legal document is worse.
- The curated privacy meta description is consciously dropped in favor of the auto-excerpt.
- **Terms is seeded with hand-written placeholder copy in all four locales** (targets still marked `machine`, so the first Dutch edit hands them to auto-translate); the owner replaces the text in admin. The seed deliberately calls no translation API — it runs inside `pnpm build`'s migrate chain, which must not depend on Google credentials or the network. The footer link goes live immediately rather than blocking the feature on client copy.

## Options rejected

- **Second hardcoded page** — cheapest (~an hour), but fails the actual requirement: owner self-serve editing.
- **Fixed set of editable pages (no create/delete)** — fewer concepts, but the client explicitly wants to create future pages (house rules, local tips, …).
- **Prefixed URLs (`/{locale}/p/{slug}`)** — eliminates slug collisions forever, but `/privacy` is already indexed and linked; a redirect plus CMS-looking legal URLs wasn't worth it. The blocklist is the contained cost.
- **Owner-editable slugs (+ redirect table)** — invites link rot on URLs pasted into emails and indexed by Google; the booking form links `/privacy`, so stability is not theoretical.
- **Block-based layout builder** — no named page needs more than headings, paragraphs, lists, and links; a new persistence format, admin UI, and renderer for hypothetical layout needs is speculative generality.
- **Keeping privacy hardcoded alongside the builder** — permanent asymmetry: the owner could edit terms but would need a developer for privacy.

## Consequences

- Legal text leaves git: no version history, review, or rollback for privacy/terms wording changes — the owner is trusted, matching every other content surface in the backoffice.
- Every future top-level static route must be added to the reserved-slug blocklist, and can never claim a slug an existing page already uses.
- The booking form's privacy link and the footer's legal links depend on the pinned slugs `privacy` and `terms` — safe only because system pages are undeletable and always published.
- The public surface is no longer strictly "one long anchored landing page per locale": it's the landing page plus owner-managed pages (and POI details).
