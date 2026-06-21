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

**UI chrome** — static strings (buttons, labels, section titles, form validation). Translated at build time in next-intl message files. No DB involvement.

**Dynamic content** — owner-managed records stored in the DB, translatable per field. Owner writes in Dutch (primary), then clicks **Auto-translate** to fill EN/FR/DE via DeepL. Fields the owner edits manually are marked **human-edited** and protected from being overwritten by a later re-translate. Fields filled by DeepL are marked **machine**.

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
- **Playwright** — full request-cycle tests against a running `next dev` server. The authoritative runner for anything involving Server Components, routing, or middleware. Tests live in `e2e/**/*.spec.ts`.

## Settings

Owner-configurable values stored in a key-value `setting` table (`key TEXT PRIMARY KEY, value TEXT`). Known keys are declared in a Zod schema; code reads settings through typed accessors that parse and validate values. New keys require no schema migration.

Current keys: `iban`, `bank_name`, `account_holder`, `payment_deadline_days` (default `"7"`).

## Key domain terms

| Term                           | Meaning                                                                                                                                                                                                                                            |
| ------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Booking request**            | A guest's availability inquiry, submitted via the public form                                                                                                                                                                                      |
| **On hold**                    | Status after owner confirmation, before payment; dates are blocked in the export feed                                                                                                                                                              |
| **Payment deadline**           | The date by which the guest must pay, or the hold expires automatically                                                                                                                                                                            |
| **Display status**             | The UI-layer status type; extends the DB enum with `expired` (computed, never stored)                                                                                                                                                              |
| **Busy intervals**             | Merged unavailable date ranges from all inbound iCal sources plus live DB holds                                                                                                                                                                    |
| **iCal source**                | A first-class record (name + URL + enabled) for one inbound platform feed                                                                                                                                                                          |
| **Feed sync health**           | Per-source `lastSyncedAt` / `lastError`, written on each lazy refresh, shown in admin                                                                                                                                                              |
| **Export feed**                | The site's own outbound `.ics` file, subscribed to by Airbnb and Natuurhuisje. Access is controlled by per-service export tokens.                                                                                                                  |
| **Export token**               | A named, unguessable random string giving one platform read access to the export feed at `/api/ical/{token}.ics`. Stored in the `ical_export_token` table (not `setting`). Multiple can coexist; deleting one revokes only that platform's access. |
| **Inbox**                      | The backoffice view listing all booking requests by status (`/admin/bookings`)                                                                                                                                                                     |
| **POI**                        | Point of Interest — a card in the "Discover the area" section                                                                                                                                                                                      |
| **Content block**              | A keyed singleton content unit (e.g. `hero_subtitle`, `description`)                                                                                                                                                                               |
| **Auto-translate**             | The DeepL-powered server action that fills EN/FR/DE from a Dutch source field                                                                                                                                                                      |
| **Human-edited**               | A field manually edited by the owner; protected from auto-translate overwrite                                                                                                                                                                      |
| **Machine**                    | A field filled by auto-translate; can be overwritten by a later re-translate                                                                                                                                                                       |
| **Bank-transfer instructions** | The payment details emailed to the guest (in their locale) on hold confirmation                                                                                                                                                                    |
