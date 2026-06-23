# ADR-0008: Native params-based i18n instead of next-intl

**Status:** Accepted

## Context

UI-chrome translation (see [ADR-0003](0003-jsonb-i18n-columns.md) for the _dynamic_ content
model — this ADR is only about static strings) was handled by `next-intl`. `next-intl`
resolves the active locale through **request-scoped** APIs (`requestLocale` inside
`getRequestConfig`, the `createMiddleware` proxy, the `NextIntlClientProvider` async context).

Reading request scope is an uncached runtime access. Under Next 16's `cacheComponents`, that
forces every component calling `getTranslations` / `useTranslations` into dynamic rendering —
they can be neither prerendered nor wrapped in `"use cache"`. Since virtually every page uses
translations, `next-intl` effectively made `cacheComponents` unusable for the whole site.

The route already carries the locale as the `[locale]` segment, and the root layout enumerates
all locales via `generateStaticParams`, so locale-from-`param` is statically known and
prerenderable.

## Decision

Remove `next-intl` and resolve the **active locale only from the `[locale]` route param**.

- **ICU formatting** (interpolation, plurals, `<strong>` rich text) is kept via
  `intl-messageformat` — the same engine `next-intl` wraps, but framework-agnostic with **zero
  request-scoped reads**. Message files (`messages/{locale}.json`) are unchanged.
- **Server:** `getDictionary(locale)` + `getTranslations({ locale, namespace })` in `src/i18n/`,
  with `locale` always passed in from `params`.
- **Client:** a small `I18nProvider` seeded by the server layout from the param, exposing
  `useTranslations` / `useLocale` with the same surface as before.
- **Locale negotiation** (`/` → `/{locale}`) is a hand-rolled `Accept-Language` parse in
  `proxy.ts` — no `negotiator` / `intl-localematcher` deps.
- A tiny locale-prepending `Link` wrapper at `@/i18n/navigation` preserves existing call sites.

This change does **not** enable `cacheComponents` — it only makes the i18n layer compatible.
Flipping the flag is a separate effort (admin/auth/db routes still need Suspense boundaries).

## Considered options

- **Keep next-intl** — rejected: the request-scoped locale resolution is the exact blocker.
- **Swap to another i18n lib** (e.g. next-international) — rejected: only helps if its locale
  resolution is param-based too, and it still adds a framework-coupled dependency to verify.
- **Hand-roll the ICU engine** (~70 lines) — rejected: `intl-messageformat` is small, CLDR-correct,
  and is the engine we were already shipping transitively via next-intl.

## Consequences

- The `[locale]` marketing routes now prerender as static HTML (verified in build output), the
  prerequisite for `cacheComponents`.
- Server Actions must read locale from the form (the existing hidden `_locale` field) rather than
  request scope; `book/action.ts` does this.
- `intl-messageformat` lands in the client bundle wherever `useTranslations` is used.
- We own locale negotiation and the `Link` wrapper — trivial, but no longer maintained upstream.
