# Gîte La Cour de Haut — Project Context

## What this is

A vacation rental property in Normandy (France). The site is an **inquiry-and-confirmation funnel** — not a booking engine. No online payments. Real money never touches the site.

## The three surfaces

1. **Public page** — one long anchored landing page per locale. The "single page" only applies here.
2. **Backoffice** (`/admin`) — single-owner login: inbox of requests + content editing.
3. **Server routes** — inbound iCal sync, outbound iCal feed, request submission, content/translate actions.

## The owner

A single person who manages the property. They:

- Review booking requests in the **inbox**
- Confirm requests and send **bank-transfer instructions** manually via email
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
- **expired** — payment deadline passed without payment; dates released from feed.
- **declined / cancelled** — dates released from feed.

## iCal sync

**Inbound** (read): the site fetches platform feeds (Airbnb, Natuurhuisje), merges them into **busy intervals**, and uses them to render the availability calendar and prevent the owner from confirming a conflicting request.

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

## Key domain terms

| Term                           | Meaning                                                                               |
| ------------------------------ | ------------------------------------------------------------------------------------- |
| **Booking request**            | A guest's availability inquiry, submitted via the public form                         |
| **On hold**                    | Status after owner confirmation, before payment; dates are blocked in the export feed |
| **Payment deadline**           | The date by which the guest must pay, or the hold expires automatically               |
| **Busy intervals**             | Merged unavailable date ranges from all inbound iCal feeds                            |
| **Export feed**                | The site's own outbound `.ics` file, subscribed to by Airbnb and Natuurhuisje         |
| **Inbox**                      | The backoffice view listing all booking requests by status                            |
| **POI**                        | Point of Interest — a card in the "Discover the area" section                         |
| **Content block**              | A keyed singleton content unit (e.g. `hero_subtitle`, `description`)                  |
| **Auto-translate**             | The DeepL-powered server action that fills EN/FR/DE from a Dutch source field         |
| **Human-edited**               | A field manually edited by the owner; protected from auto-translate overwrite         |
| **Machine**                    | A field filled by auto-translate; can be overwritten by a later re-translate          |
| **Bank-transfer instructions** | The payment details emailed to the guest on hold confirmation                         |
