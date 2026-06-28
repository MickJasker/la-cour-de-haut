# ADR-0011: Error & not-found handling across two root layouts

**Status:** Accepted

## Context

The app had no `error`, `not-found`, or `global-error` files at all — every uncaught
render/data error and every unmatched URL fell through to Next.js's unstyled default screen.
Adding them is not boilerplate here, because the routing shape constrains what works:

- **There is no `app/layout.tsx`.** The app uses Next's _multiple root layouts_ pattern:
  `src/app/[locale]/layout.tsx` and `src/app/admin/layout.tsx` each render their own
  `<html>/<body>` + fonts. The public root is also a **top-level dynamic segment**
  (`[locale]`).
- **i18n is split server/client** (see [ADR-0008](0008-native-i18n-for-cache-components.md)).
  The active locale comes from the `[locale]` route param; client components read it from
  `I18nProvider`, which is set up _inside_ `[locale]/layout.tsx`.
- **Routing is already handled by `src/proxy.ts`** (Next 16 renamed Middleware → Proxy): it
  negotiates `Accept-Language` → `[nl,en,fr,de]` (fallback `nl`), redirects `/` and any
  no-locale path to a locale, and gates `/admin/*` on a session cookie.

Two Next 16 mechanics drive the design (verified against the bundled docs):

1. `error.tsx` wraps its segment's children but **not its own segment's `layout.tsx`**. So a
   public `error.tsx` catches _page_ errors (where `I18nProvider` is alive → localizable) but
   not failures in `[locale]/layout.tsx` itself.
2. A nested `not-found.tsx` only renders for an **explicit `notFound()`** call. Genuinely
   _unmatched_ URLs (`/nl/typo`, `/admin/typo`) bubble to the app-level handler — and with no
   `app/layout.tsx`, a plain `app/not-found.tsx` has no root to render in.

## Decision

Place boundaries per tree, plus two self-contained app-level fallbacks:

- **`[locale]/not-found.tsx` + `[locale]/error.tsx`** — localized (via `I18nProvider`,
  `errors.*` message keys), minimal centered layout reusing the `privacy/page.tsx` pattern.
- **`admin/(private)/not-found.tsx` + `error.tsx`** — hardcoded **Dutch** (admin has no i18n
  provider; the owner is Dutch), rendered inside the sidebar so navigation is retained.
- **`app/global-not-found.tsx`** — the catch-all for all unmatched URLs across both trees.
  Enabled with `experimental.globalNotFound: true`. Self-contained (own `<html>/<body>`,
  fonts, `globals.css`); copy is **English**, the safest fallback for an unknown visitor whose
  locale we can't reliably resolve. "Back to home" links to `/` so the proxy re-negotiates.
- **`app/global-error.tsx`** — last-resort boundary for a root-layout failure. Self-contained,
  **English**, `unstable_retry()` to recover.
- **No `app/not-found.tsx`** — there is no root layout to host it; `global-not-found` is the
  documented replacement for this shape.

Error boundaries follow the repo convention (`console.error(error)` in `useEffect`; no
telemetry library) and use the Next 16 `{ error, unstable_retry }` prop. Expected errors
(form validation) stay modeled as `useActionState` return values — boundaries are for
_unexpected_ exceptions only.

While here, the proxy `config.matcher` was fixed: it excluded image extensions but not
`.xml`/`.txt`, so `/sitemap.xml` and `/robots.txt` were being redirected to
`/nl/sitemap.xml` → 404, silently breaking the SEO metadata routes
(`src/app/sitemap.ts`, `src/app/robots.ts`). `xml|txt|ico` were added to the
excluded-extension group.

## Considered options

- **A single localized 404 for everything** — not possible. With `globalNotFound`, unmatched
  URLs are served by one global page that bypasses normal rendering and can't reliably read the
  request locale, so it is English. Localized public 404s only fire on explicit `notFound()`.
- **A root `app/layout.tsx` + `app/not-found.tsx` instead of the experimental flag** — rejected:
  it would mean collapsing the two independent `<html>` trees (public vs admin, different fonts,
  different `<Suspense>`/PPR posture) into one shared root, a much larger and riskier change than
  adopting `global-not-found`.
- **`next.config` redirects instead of touching the proxy matcher** — N/A; the redirect logic
  already lives in `proxy.ts`, so the matcher is the right place to fix the metadata-route leak.

## Consequences

- The localized `[locale]/not-found.tsx` rarely fires today (no public page calls `notFound()`
  yet); typo URLs land on the English `global-not-found`. It is kept for completeness and future
  public dynamic routes.
- A sidebar-_layout_ failure in admin bubbles past `admin/(private)/error.tsx` to the English
  `global-error` (no Dutch, no sidebar) — accepted, as that failure is rare.
- We now depend on an **experimental** Next flag (`globalNotFound`) alongside the existing
  experimental `cacheComponents`; a Next upgrade could change either. The build step is the guard.
- `/sitemap.xml` and `/robots.txt` resolve directly again (HTTP 200), restoring the SEO routes.
