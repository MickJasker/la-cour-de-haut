# ADR-0015: Rich-text POI detail — Lexical EditorState storage + HTML translation bridge

**Status:** Accepted

Refines [ADR-0003](./0003-jsonb-i18n-columns.md) (jsonb i18n columns) the way [ADR-0014](./0014-review-original-language.md) does, and reuses the intercepted-route pattern documented incidentally in [ADR-0009](./0009-e2e-against-production-build.md).

## Context

A POI was a flat card: `title` + one short plain `body` + one image + `distanceKm`, rendered only as a card with no detail view. The client asked for richer per-POI content. We want formatted prose (headings, bold/italic, lists, links) shown on a dedicated POI view, opened as a dialog from the landing page with its own standalone, shareable, indexable page — and a rich-text capability reusable for future content.

Two forces pull against each other. **Lexical's own guidance** is to store the serialized `EditorState` JSON as the source of truth (its HTML import/export is explicitly lossy). But the **translation pipeline speaks plain text / HTML**: `translateToAllLocales` calls Google Cloud Translation v3 with `mimeType: "text/plain"`, per field, Dutch → {en, fr, de}. A serialized node tree handed to Google as plain text would have its JSON keys translated. POIs are authored content, so the rich field must survive translation into all four launch locales — it cannot simply fall back to Dutch.

## Decision

A POI gains an optional rich-text `detail`, stored per-locale as serialized Lexical `EditorState` JSON, translated through an admin-only HTML bridge, and rendered on the public side without any Lexical runtime.

- **Storage.** New `jsonb` column `detail` shaped `{ nl, en?, fr?, de? }` (`LocalizedEditorState`), nullable so a POI need not have detail; companion `detail_source` reuses `LocalizedSource`. The short `body` is unchanged and stays the card teaser. Detail with no real text is stored as `NULL` (`hasEditorText`).
- **Feature set is a single source of truth.** A fixed minimal node set — paragraph, h2/h3, bold/italic, bullet/numbered lists, links — is declared once in `src/lib/lexical/nodes.ts`, registered by both the admin editor and the headless bridge so HTML round-trips faithfully. No images/embeds/custom nodes.
- **Public render carries zero Lexical.** `RichTextRenderer` is a synchronous server component that walks the serialized JSON into React elements. No headless Lexical, no DOM shim, no `dangerouslySetInnerHTML`, no sanitizer library; link `href`s are validated to http/https/mailto (unsafe schemes render as plain text). It runs inside `"use cache"` with no client JS.
- **Translation is admin-only, machine-only, via an HTML bridge.** `editorStateToHtml` / `htmlToEditorState` (`@lexical/headless` + `@lexical/html`) convert nl JSON → HTML → Google `text/html` → HTML → JSON. HTML mode preserves inline tags so links/bold mid-sentence translate correctly. The bridge lazily imports `happy-dom` for a `DOMParser` and restores globals after use, confined to one server action (`translatePoiDetailAction`) and lazy-imported exactly like `translate.ts` lazy-imports the Google client. Translations are not hand-editable; to fix one, fix the Dutch and re-translate, so `detail_source` is deterministic (`nl` human, the rest machine).
- **Slug.** New `slug TEXT NOT NULL UNIQUE`, auto-generated at create from the **English translation** of the Dutch title (reusing the owner's translation when present, else translating just the title), slugified and deduped. **Stable after create** — never regenerated on rename, so shared/indexed links never break.
- **Route.** `/[locale]/poi/[slug]` is a standalone PPR page (Header + Suspense'd detail, `generateMetadata` with canonical + hreflang via the cached slug query) with `generateStaticParams` over published slugs; `@modal/(.)poi/[slug]` intercepts the same URL on soft-nav into a Dialog (`router.back()` on close), reusing the existing `@modal` slot. The server-rendered detail is passed as `children` into the client Dialog wrapper. Unknown/unpublished slugs call `notFound()` (ADR-0011). Published POIs are appended to the cached sitemap.
- **Migration.** Add `slug` nullable, backfill from the slugified Dutch title with collision suffixes, then `SET NOT NULL` + `UNIQUE`; add `detail`/`detail_source` nullable. Hand-edited because drizzle-kit's bare `ADD COLUMN slug text NOT NULL` would fail on existing rows and on the production build's `db:migrate`.

## Consequences

- New heavyweight dependencies (Lexical + `happy-dom`) are kept entirely off the client bundle and the prerender path. The only HTML-generating code (the bridge) lives in the admin write path, so the public read path is trivially safe and cacheable — the inverse of where complexity usually accumulates.
- The detail field is deliberately **not** part of the TanStack form value type: a recursive `EditorState` type blows up the form's `DeepKeys` inference ("excessively deep"). It is managed as `useState` and attached to `FormData` manually, like the image dropzone's `File`. Rich content is opaque machine JSON, not a navigable form field.
- `translateToAllLocales` is left untouched; `translateHtmlToAllLocales` is added alongside it, sharing one helper — mirroring how ADR-0014 added `translateReviewBody` rather than changing the authored-content path.
- The HTML round-trip is mildly lossy for exotic markup, which is why the node set is fixed and small; adding custom interactive nodes later (maps, embeds) is the trigger to revisit this ADR.
- `await params` for the dynamic `[slug]` is only safe because `generateStaticParams` enumerates published slugs; without it the route turns fully dynamic and pushes the `[locale]` layout's `I18nProvider` out of the static shell at build time.
