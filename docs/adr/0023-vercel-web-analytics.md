# ADR-0023: Vercel Web Analytics with funnel events, no consent banner

**Status:** Accepted

## Context

The site is an inquiry-and-confirmation funnel: its one conversion is a submitted booking request. There is currently no analytics of any kind, so there is no way to see where visitors drop off — how many reach `/book`, how many find an available range and see a price, how many submit. The only cookie in the app is Better Auth's admin session cookie; there is no consent infrastructure.

Two constraints shape the design:

1. **Cache Components build noise.** `@vercel/speed-insights` was removed (2026-07-06) because its component reads `useSearchParams`, which under Cache Components logs build noise that a plain `<Suspense>` boundary does not silence; the established fix is a `useSyncExternalStore` mounted-gate that renders the widget only after hydration. `@vercel/analytics` reads the same route hooks for page attribution, so it inherits the same constraint.
2. **French/EU audience.** The site serves a French market (nl/en/fr/de locales). Any tracking choice must hold up against CNIL's consent doctrine.

## Decision

### Vercel Web Analytics, no consent banner

Vercel Web Analytics sets no cookies and writes nothing to client storage; visitors are counted via a daily-rotating server-side hash, data is aggregate-only, and collection is first-party (`/_vercel/insights` on our own domain). This places it in the class of audience-measurement tools CNIL treats as exempt from prior consent, so **no consent banner is added**. Transparency is still owed: the owner adds an audience-measurement paragraph to the `privacy` system page (ADR-0020) in all four locales via admin after launch — a content edit, not code.

Rejected: an opt-in consent banner (maximal legal caution, but real UX damage to a small conversion funnel, plus a whole consent infrastructure, to defend against a risk the tool is designed to avoid) and silent tracking with no disclosure (indefensible transparency posture for a French-market site).

**Load-bearing rule: no PII in event properties — numbers and enums only.** The exemption argument rests on the data being unable to single out a person. Never send name, email, phone, address, or any free-text field value as an event property. `nights`, `total_price`, a dialog name are fine; a booking reference or email is not. Locale needs no property — it is derivable from the pageview path.

### Mounted public-side only, production only

`<Analytics />` (from `@vercel/analytics/next`) mounts in the **`[locale]` root layout only**, wrapped in a client component behind the `useSyncExternalStore` mounted-gate (constraint 1 above). The `admin` root layout gets nothing: the admin area is used by exactly one person whose clicks would pollute visitor data, and it keeps auth pages free of third-party script.

The layout renders the gate only when `process.env.VERCEL_ENV === "production"` (a server-side check — the value never reaches the client bundle). This keeps three environments silent at once:

- **local dev** — nothing to measure;
- **local production builds** — Playwright runs against `next build` (ADR-0009); without the check the injected script would 404 against localhost and spray console noise into every e2e run;
- **preview deployments** — preview traffic is only ever the owner/developer; excluding it keeps the dashboard numbers meaning "real visitors" without per-read environment filtering.

`track()` calls need no such guard: outside production the analytics script is never injected, and `track()` no-ops when the script is absent (implementers should verify this against the installed package version; if it warns or throws, gate the call sites too).

### Event taxonomy

Five custom events, each anchored to a distinct funnel moment in code. All are fire-once per moment (guarded, not fired on every re-render or repeat interaction):

| Event                       | Trigger                                                                    | Properties                                                                                    |
| --------------------------- | -------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------- |
| `calendar_engaged`          | first date click in the availability calendar (`book-form.tsx` `onSelect`) | —                                                                                             |
| `quote_shown`               | first complete valid range selected — the price breakdown renders          | `nights`, `lead_time_days`                                                                    |
| `booking_submit_failed`     | submit attempted but blocked                                               | `reason`: `"validation"` (client Zod) \| `"server"` (`state.formError`: Turnstile, conflicts) |
| `booking_request_submitted` | booking server action returns success                                      | `nights`, `guests`, `lead_time_days`, `total_price`                                           |
| `info_dialog_opened`        | `gite-dialog.tsx` / `general-info-dialog.tsx` opens                        | `dialog`: `"gite"` \| `"general_info"`                                                        |

`lead_time_days` = days between the visit and the selected arrival date.

`calendar_engaged` vs `quote_shown` is deliberate: with half-day availability rules (#183), "touched the calendar but never produced a price" is its own failure mode — the visitor tried and couldn't find an open range.

Rejected events:

- **`booking_dialog_opened` / POI modal opens** — both are intercepted routes (`@modal/(.)book`, `@modal/(.)poi`); opening them navigates, so they are already pageviews. A custom event would double-count the funnel step.
- **separate `gite_dialog_opened` / `general_info_dialog_opened` names** — the two `useState` dialogs (invisible to pageviews, hence events at all) share one event name with a `dialog` property, keeping the dashboard's event list a clean funnel while staying segmentable.

Event handlers, not render effects: funnel events fire from the interaction that causes them (`onSelect`, submit flow) wherever possible. Only outcomes that arrive asynchronously via `useActionState` (server success/failure) may use an effect synchronizing to the external analytics system.

### Plan limits accepted

The project runs on a Hobby team: 50k events/month (far above this site's traffic) and **1 month data retention** — no year-over-year seasonality comparisons without upgrading or exporting via the Web Analytics API. Accepted for now; revisit if retention starts to matter.

## Follow-ups (owner, manual)

- Enable Web Analytics for the project in the Vercel dashboard (no code path can do this).
- Add the audience-measurement paragraph to the `privacy` page in all four locales via admin.
