# Gîte La Cour de Haut — Project Context

## What this is

A vacation rental property in Normandy (France). The site is an **inquiry-and-confirmation funnel** — not a booking engine. No online payments. Real money never touches the site.

## The three surfaces

1. **Public page** — one long anchored landing page per locale. The "single page" only applies here.
2. **Backoffice** (`/admin`) — single-owner login: inbox of requests + content editing.
3. **Server routes** — inbound iCal sync, outbound iCal feed, request submission, content/translate actions.

## The owner

A single person who manages the property. They:

- Review booking requests in the **inbox** (`/admin/bookings`)
- Confirm requests; the site emails **bank-transfer instructions** automatically to the guest on confirm
- Manage content (description, POIs, reviews, settings) in the backoffice

## Booking lifecycle

```
requested ──(owner confirms)──► on_hold ──(payment received)──► confirmed
    │                              │
    │                              └─(deadline passes)──► expired ──► dates released
    └─(owner declines)──► declined
                        on_hold / confirmed ──(owner cancels)──► cancelled ──► dates released
```

- **requested** — form submitted; owner notified by email. Dates not yet held.
- **on_hold** — owner confirmed; dates enter the outbound iCal feed immediately, platforms start blocking them. Guest is emailed bank details + a payment deadline.
- **confirmed** — payment received; owner marks paid. Dates remain in feed.
- **expired** — payment deadline passed without payment; dates released from feed. **Never stored in the DB** — computed lazily at query time (`on_hold` + `payment_deadline < now()`). See ADR-0004.
- **declined / cancelled** — dates released from feed.

## iCal sync

**Inbound** (read): the site fetches **iCal sources** (Airbnb, Natuurhuisje, and any others the owner adds), merges them into **busy intervals**, and uses them to render the availability calendar and prevent the owner from confirming a conflicting request. Each source is a first-class record (not a fixed setting), so new platforms can be added without a schema change. Feeds are refreshed **lazily on read**: a source older than ~1 hour is re-fetched and its result cached back onto the source record, mirroring the lazy-expiry pattern of [ADR-0004](docs/adr/0004-lazy-hold-expiry-no-cron.md) (see also [ADR-0005](docs/adr/0005-db-materialized-lazy-ical-refresh.md)). No cron.

**Outbound** (write-back): the site exposes its own **export feed** at a stable, unguessable URL (`/api/ical/{token}.ics`) listing held and confirmed direct bookings. Platforms subscribe once during setup and block those dates on their end.

**Sync is not instant** — platforms poll on their own schedule (typically hours). The human confirm + bank-transfer step is the real double-booking safeguard.

## The translate content model

Two distinct layers:

**UI chrome** — static strings (buttons, labels, section titles, form validation). Held in per-locale message files (`messages/{locale}.json`) and resolved by the **active locale**, which is always read from the URL's `[locale]` segment — never from the request. No DB involvement. See [ADR-0008](docs/adr/0008-native-i18n-for-cache-components.md).

**Dynamic content** — owner-managed records stored in the DB, translatable per field. Owner writes in Dutch (primary), then clicks **Auto-translate** to fill EN/FR/DE. Fields the owner edits manually are marked **human-edited** and protected from being overwritten by a later re-translate. Fields filled by auto-translate are marked **machine**.

This holds for **authored content** (POIs, content blocks) — written by the owner, so Dutch is always the original. **Reviews are quoted content** and the exception: the canonical text is a guest's verbatim words in their own **original locale**, often not Dutch and sometimes outside the four display locales. A review stores `original_body` + `original_locale` as its source of truth and translates outward from there; `body` is a derived projection. See [ADR-0014](docs/adr/0014-review-original-language.md).

Storage pattern per translatable field:

```
title:        { nl: "...", en: "...", fr: "...", de: "..." }
title_source: { nl: "human", en: "machine", fr: "human", de: "machine" }
```

## Locales

`nl` (Dutch) is the primary authoring language. `en`, `fr`, `de` are hard launch requirements.

## Testing boundaries

Two test runners, strictly separated by what they can see:

- **Vitest** — utility functions and synchronous client components only. Async Server Components are unsupported by Vitest (React ecosystem limitation). Tests live in `src/**/*.test.ts(x)`, co-located with source.
- **Playwright** — full request-cycle tests. The authoritative runner for anything involving Server Components, routing, or middleware. Tests live in `e2e/**/*.spec.ts`. Locally it drives `next dev`; **on CI it runs against a production build** (`next build && next start`), because Cache Components / PPR don't actually run under `next dev` — see [ADR-0009](docs/adr/0009-e2e-against-production-build.md). The suite `TRUNCATE`s core tables in `global-setup`, so only run it against a disposable database (CI uses a per-run Neon branch), never your dev DB.

## Settings

Owner-configurable values stored in a key-value `setting` table (`key TEXT PRIMARY KEY, value TEXT`). Known keys are declared in a Zod schema; code reads settings through typed accessors that parse and validate values. New keys require no schema migration.

Current keys: `iban`, `bank_name`, `account_holder`, `payment_deadline_days` (default `"7"`).

## Media storage

Binary assets (photos) are stored in **Vercel Blob**; only the public URL is kept in the DB. The upload flow is: `<input type="file">` → server action → `put()` to Blob → insert row with `imageUrl`. Deleting an image calls `del(imageUrl)` (skipped for non-Blob URLs, e.g. in tests) then removes the DB row.

## Key domain terms

| Term                           | Meaning                                                                                                                                                                                                                                                                                                                                               |
| ------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Active locale**              | The locale in effect for a render, always derived from the URL's `[locale]` segment (a route param) — never from request headers/cookies. Resolving it from the param is what keeps pages prerenderable / `cacheComponents`-compatible.                                                                                                               |
| **Booking request**            | A guest's availability inquiry, submitted via the public form                                                                                                                                                                                                                                                                                         |
| **Guest address**              | The guest's postal address (street + house number, postal code, city, country) captured on the booking request, for the owner's records and the rental contract. `country` is stored as an ISO 3166-1 alpha-2 code and localized for display; the other three parts are free text. See [ADR-0012](docs/adr/0012-guest-address-on-booking-request.md). |
| **On hold**                    | Status after owner confirmation, before payment; dates are blocked in the export feed                                                                                                                                                                                                                                                                 |
| **Payment deadline**           | The date by which the guest must pay, or the hold expires automatically                                                                                                                                                                                                                                                                               |
| **Display status**             | The UI-layer status type; extends the DB enum with `expired` (computed, never stored)                                                                                                                                                                                                                                                                 |
| **Busy intervals**             | Merged unavailable date ranges from all inbound iCal sources plus live DB holds                                                                                                                                                                                                                                                                       |
| **iCal source**                | A first-class record (name + URL + enabled) for one inbound platform feed                                                                                                                                                                                                                                                                             |
| **Feed sync health**           | Per-source `lastSyncedAt` / `lastError`, written on each lazy refresh, shown in admin                                                                                                                                                                                                                                                                 |
| **Export feed**                | The site's own outbound `.ics` file, subscribed to by Airbnb and Natuurhuisje. Access is controlled by per-service export tokens.                                                                                                                                                                                                                     |
| **Export token**               | A named, unguessable random string giving one platform read access to the export feed at `/api/ical/{token}.ics`. Stored in the `ical_export_token` table (not `setting`). Multiple can coexist; deleting one revokes only that platform's access.                                                                                                    |
| **Inbox**                      | The backoffice view listing all booking requests by status (`/admin/bookings`)                                                                                                                                                                                                                                                                        |
| **POI**                        | Point of Interest — a card in the "Discover the area" section, linking to a detail dialog/page                                                                                                                                                                                                                                                        |
| **POI detail**                 | Optional rich-text body of a POI, shown on its detail page/modal — distinct from the short plain `body` card teaser. Stored per-locale as a [[Lexical EditorState]]. See [ADR-0015](docs/adr/0015-poi-rich-text-detail.md).                                                                                                                           |
| **POI slug**                   | Auto-generated, URL-safe, **stable-after-create** identifier for a POI, derived from the **English** translation of the Dutch title, used at `/poi/{slug}`. See [ADR-0015](docs/adr/0015-poi-rich-text-detail.md).                                                                                                                                    |
| **Lexical EditorState**        | The serialized JSON document format (from the Lexical editor) stored per-locale in `poi.detail`. Rendered to HTML on the public side by a hand-written walker carrying no Lexical runtime.                                                                                                                                                            |
| **Rich-text bridge**           | Admin-only EditorState↔HTML conversion (`@lexical/headless`/`html` + lazy `happy-dom`) that lets rich content be machine-translated as `text/html`. Never runs on the public render path. See [ADR-0015](docs/adr/0015-poi-rich-text-detail.md).                                                                                                      |
| **Content block**              | A keyed singleton content unit (e.g. `hero_subtitle`, `description`)                                                                                                                                                                                                                                                                                  |
| **Auto-translate**             | The server action that fills the display locales from a source field. For **authored content** the source is Dutch; for **quoted content** (reviews) it is the review's **original locale**. Plain fields translate as `text/plain`; the rich [[POI detail]] translates as `text/html` through the [[Rich-text bridge]].                              |
| **Human-edited**               | A field manually edited by the owner; protected from auto-translate overwrite                                                                                                                                                                                                                                                                         |
| **Machine**                    | A field filled by auto-translate; can be overwritten by a later re-translate                                                                                                                                                                                                                                                                          |
| **Authored content**           | Owner-written translatable content (POIs, content blocks); Dutch is always the original, translated outward to EN/FR/DE                                                                                                                                                                                                                               |
| **Quoted content**             | Translatable content authored by a third party (currently only **reviews**); its canonical language is the author's **original locale**, not Dutch. See [ADR-0014](docs/adr/0014-review-original-language.md).                                                                                                                                        |
| **Original locale**            | The language a review's guest actually wrote in — the source of truth for translation. May be one of the four display locales or outside them (the verbatim text is kept in `original_body`). Holds the BCP-47 sentinel `und` until auto-detected. Distinct from a review's **source** (the platform: Airbnb / Google / …).                           |
| **Bank-transfer instructions** | The payment details emailed to the guest (in their locale) on hold confirmation                                                                                                                                                                                                                                                                       |
| **Gallery image**              | An owner-uploaded photo stored in Vercel Blob; its public URL is persisted in `gallery_image` (`sort_order`, `published`). Only published images appear on the public page. The first 4 (by `sort_order`) show in the inline 2×2 grid; all appear in a Dialog.                                                                                        |
