# Gîte La Cour de Haut — Design Document

_Single public marketing page + owner backoffice, for a vacation rental in Normandy._

---

## 1. Scope & load-bearing assumptions

This is an **inquiry-and-confirmation funnel**, not a booking engine. No online payments, no transactional booking flow on the site itself.

- Guests submit a **booking request** via a form.
- The owner reviews it, **confirms**, and emails **bank-transfer instructions**.
- On confirmation, the dates are **held and published to the site's own iCal feed**, which Airbnb / Natuurhuisje subscribe to, so they block those dates.
- Real money never touches the site.

Three surfaces, despite the "single page" brief:

1. **Public page** — one long anchored landing page per locale (the "single page" only applies here).
2. **Backoffice** (`/admin`) — single-owner login: inbox of requests + content editing.
3. **Server routes** — inbound iCal sync, outbound iCal feed, request submission, content/translate actions.

**Languages:** Dutch (primary) + English, French, German. All four are a hard launch requirement.

**Budget:** effectively €0, and everything fits comfortably in free tiers. The domain is secured: **`lacourdehaut.fr`** (also the email-sending domain for Resend).

---

## 2. Architecture overview

| Concern        | Choice                              | Why                                                                                                               |
| -------------- | ----------------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| Framework      | **Next.js (App Router)**            | Required; SSR/ISR fits the iCal caching model                                                                     |
| Styling / UI   | **TailwindCSS + shadcn/ui**         | Required                                                                                                          |
| Forms          | **TanStack Form**                   | Required; used for the request form + all admin forms                                                             |
| i18n           | **next-intl**                       | App Router standard; locale routing + static UI strings                                                           |
| Hosting        | **Vercel**                          | Free Hobby tier                                                                                                   |
| Database       | **Neon (Postgres)**                 | Generous free tier; serverless                                                                                    |
| ORM            | **Drizzle**                         | Light cold-start footprint on serverless; clean with Neon                                                         |
| Image storage  | **Vercel Blob**                     | Free tier; feeds `next/image`                                                                                     |
| Auth           | **Better Auth (email/password)**    | TypeScript-native; first-class Drizzle adapter → auth tables live in the same Neon DB; trivial for a single owner |
| Email          | **Resend**                          | Free tier; owner notifications + payment instructions                                                             |
| Spam           | **Cloudflare Turnstile + honeypot** | Free; protects the public form                                                                                    |
| Auto-translate | **DeepL Free API**                  | Free monthly allowance far exceeds this volume; strong NL/EN/FR/DE quality                                        |

> The free-tier limits of DeepL, Resend, and Vercel Cron change over time — confirm current allowances at signup. The design below is structured so none of them are load-bearing at this traffic level.

---

## 3. Internationalisation & the auto-translate content model

Two distinct layers, handled differently:

**UI chrome** (buttons, labels, section titles, form validation) — static, translated by you at build time in `next-intl` message files (`/messages/{nl,en,fr,de}.json`). No DB involvement.

**Dynamic content** (description, POIs, reviews, contact copy) — owner-managed, stored in the DB, **translatable per record**. Workflow:

1. Owner writes the record in **Dutch** (primary).
2. Owner clicks **"Auto-translate"** → a server action calls DeepL and fills EN/FR/DE.
3. Owner can **tweak any field**; edited fields are marked as **human-edited** so a later re-translate won't clobber them.

**Storage:** each translatable field is a `jsonb` object keyed by locale, with a parallel source map:

```
title:        { nl: "...", en: "...", fr: "...", de: "..." }
title_source: { nl: "human", en: "machine", fr: "human", de: "machine" }
```

This keeps tables flat, makes the translate action trivial (only fill keys that are missing or still `machine`), and avoids schema churn. _(Alternative if you prefer strict typing: one column per language. Cleaner types, more verbose, and re-translate logic is the same.)_

---

## 4. iCal sync — the integration that carries the risk

### Direction of data flow

```
   Airbnb feed  ─┐
                 ├─►  [ site imports ]  ──►  display availability
 Natuurhuisje ─┘                            block conflicting requests

 confirmed direct bookings  ──►  [ site EXPORTS its own .ics ]  ──►  Airbnb / Natuurhuisje subscribe
```

**Inbound** (read): a server function fetches both platform feeds (client-side is blocked by CORS), parses them with `node-ical`, merges to busy intervals, and caches via **ISR / on-demand revalidation** (e.g. revalidate hourly). Used to render the read-only availability calendar and to prevent the owner from confirming a request that conflicts with an existing platform booking.

**Outbound** (write-back): the site exposes its own feed at a **stable, unguessable URL** containing a long random token, e.g. `/api/ical/{token}.ics`. It lists held + confirmed direct bookings as `VEVENT`s. The owner pastes this URL into Airbnb's and Natuurhuisje's _import calendar_ settings **once** during setup.

### Caveats to communicate to the owner

- **Setup is manual & one-time** per platform.
- **Sync is not instant** — Airbnb polls on its own schedule (typically a few hours), so a double-booking window genuinely exists. The human confirmation + bank-transfer step is the real safeguard.
- The feed is fetched **unauthenticated** by the platforms, so it's effectively public — include **no guest PII** in it (use a generic summary like "Booked"). The token only obscures the URL.

### No cron strictly required

The free tier doesn't need scheduled jobs: inbound feeds use ISR caching, the outbound feed is generated **on request** when a platform fetches it, and expired holds are released **lazily** (checked on read). If you later want guaranteed hold expiry, a single daily Vercel Cron job covers it.

---

## 5. Booking lifecycle

```
requested ──(owner confirms)──► on_hold ──(payment received)──► confirmed
    │                              │
    │                              └─(deadline passes)──► expired ──► dates released
    └─(owner declines)──► declined
                        on_hold / confirmed ──(owner cancels)──► cancelled ──► dates released
```

- **requested** — form submitted; owner notified by email. Not in the export feed.
- **on_hold** — owner confirmed; **dates enter the export feed immediately** (platforms start blocking); guest emailed bank details + a payment deadline (e.g. 5 days).
- **confirmed** — payment received, owner marks paid; stays in feed.
- **expired / declined / cancelled** — dates removed from the feed.

> **Decided:** block on _confirm_ (dates held the moment the owner confirms), with an auto-expiring hold so unpaid holds release their dates. Safer than block-on-payment given the iCal polling latency.

---

## 6. Data model (Drizzle / Postgres)

```
booking_request
  id, status (enum), created_at, confirmed_at, payment_deadline,
  guest_name, guest_email, guest_phone,
  date_from, date_to, num_guests,
  message, amount, owner_notes

poi  (Discover the area)
  id, image_url, sort_order, published,
  title (jsonb i18n), title_source (jsonb),
  body  (jsonb i18n), body_source  (jsonb)

review
  id, author_name, rating, review_date, source (airbnb/natuurhuisje/direct),
  sort_order, published,
  body (jsonb i18n), body_source (jsonb)

content_block  (keyed singletons: hero_subtitle, description, etc.)
  key, image_url,
  value (jsonb i18n), value_source (jsonb)

setting  (single row or key/value)
  contact_email, contact_phone, iban, account_holder, bank_name,
  social_links, ical_export_token,
  ical_source_airbnb_url, ical_source_natuurhuisje_url
```

**Auth tables** (`user` / `session` / `account` / `verification`) are owned and generated by **Better Auth** via its Drizzle adapter — we don't hand-roll them. Single owner account, email/password.

Inbound iCal busy-intervals are cached via the Next.js data cache (or a tiny `ical_cache` table if you prefer DB-backed), not modelled as first-class records.

---

## 7. Routes & components

### Public — `/[locale]` (nl default; `/en`, `/fr`, `/de`)

- **Hero** — logo over the big photo. Ship the _Baltica_ logo as an **SVG/PNG asset** rather than licensing the webfont.
- **Description** + photo gallery.
- **Discover the area** — grid of POI cards; click opens a shadcn `Dialog` with the long text. DB-backed, owner-managed.
- **Availability** — read-only calendar (shadcn `Calendar` / react-day-picker) showing merged busy dates.
- **Reviews** — stored in our own DB, auto-translated into all four languages, curated in the backoffice. Sourcing approach in §8.
- **Sticky contact bar** (always in view, per brief) + **request form** (TanStack Form + Turnstile).
- **Privacy notice** — small standalone page; the form collects PII in the EU, so a basic GDPR notice is effectively required.

### Backoffice — `/admin`

- `/admin` login (Better Auth)
- `/admin/inbox` — requests (new / on-hold / confirmed / archived); actions: confirm, decline, mark paid, cancel
- `/admin/content` — description, hero, contact details
- `/admin/pois` — CRUD + image upload + auto-translate
- `/admin/reviews` — CRUD + auto-translate
- `/admin/settings` — IBAN/bank details, contact info, iCal source URLs, export feed URL

### Server / route handlers

- `ALL  /api/auth/*` — Better Auth handler (login, session, sign-out)
- `POST /api/booking` — validate, Turnstile check, persist, email owner
- `GET  /api/ical/{token}.ics` — outbound feed (held + confirmed bookings)
- iCal inbound fetch + merge — server function behind ISR revalidation
- Admin **server actions** — content CRUD, status transitions, translate

---

## 8. Reviews sourcing

**Decision: no scraper. Reviews live in our own DB, entered/curated by the owner, auto-translated into all four languages.**

Why not scrape Airbnb / Natuurhuisje:

- **Terms & access.** Airbnb's terms prohibit automated scraping and there is no public reviews API for individual hosts (the partner API is gated to approved companies and excludes reviews). Natuurhuisje exposes no API or review export at all — it's a manual platform. So scraping is the only "automated" route, and it runs against the platforms' rules. (Legality of scraping public data is murky and jurisdiction-dependent — not a foundation to build on.)
- **Fragility.** Airbnb has active bot-detection; reliable scraping needs a headless browser + proxies + occasional CAPTCHA-solving, and the reverse-engineered internal endpoints break without notice.
- **Stack fit.** A persistent headless-browser scraper can't run on Vercel's free serverless tier; it would require a separate paid worker, breaking the €0 budget.
- **Translation.** A scraper or third-party widget yields each review in its original language only — incompatible with the hard 4-language requirement that our DB + auto-translate already satisfies.

Chosen flow:

- **v1 — assisted entry.** Both platforms email the host when a review lands, so the text already arrives in the owner's inbox. Owner pastes it into `/admin/reviews` → auto-translate fills the other three languages → publish. Low effort at this volume (a few per month), full styling control.
- **Phase 2 (optional) — forwarded-email parsing.** An inbound address (e.g. `reviews@lacourdehaut.fr` via Resend) lets the owner forward a review email; a handler parses it into a _draft_ review for one-click approval. Fully terms-compliant (owner-initiated, human-in-the-loop).
- **Fallback only.** If the owner ever wants zero data entry, a third-party embed (e.g. Revyoos/EmbedSocial) is possible, accepting the trade-offs: single language, external styling, likely a paid tier, and an added third-party data processor (GDPR).

---

## 9. Open decisions & risks

1. **Double-booking window** — inherent to iCal polling; the human + bank-transfer step mitigates it. Make sure the owner understands it.
2. **GDPR** — privacy notice + a clear data-retention stance on stored guest contact details. (Stays self-hosted unless the review-widget fallback is ever used.)
3. **Free-tier limits** — verify DeepL / Resend / Vercel current allowances at signup; nothing here is designed to depend on them.

**Resolved:** domain (`lacourdehaut.fr`) · logo (provided as asset) · block-on-confirm (§5) · reviews via own DB, no scraper (§8).

---

## 10. Suggested build phases

1. **Foundation** — Next.js + Tailwind + shadcn + next-intl scaffold; Neon + Drizzle schema; Better Auth single-owner login.
2. **Public page (Dutch only)** — all sections static-content first, to lock layout & design against the brand palette.
3. **Backoffice content editing** — POIs, reviews, content blocks CRUD + Vercel Blob image upload.
4. **i18n + auto-translate** — wire the four locales; DeepL translate action with human-edit protection.
5. **Booking flow** — request form + Turnstile + Resend; inbox + status lifecycle.
6. **iCal sync** — inbound merge + availability calendar; outbound feed + platform setup docs for the owner.
7. **Polish** — SEO/OG per locale, privacy page, accessibility, performance pass.

Building one language end-to-end (phases 1–3, 5) before layering in the other three (phase 4) keeps each piece verifiable and is far cheaper than carrying four languages through every change.
