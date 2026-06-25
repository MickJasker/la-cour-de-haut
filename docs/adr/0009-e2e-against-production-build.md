# ADR-0009: Run E2E against a production build, not the dev server

**Status:** Accepted

## Context

The Playwright E2E suite drove its `webServer` with `pnpm dev`. That was fine before
`cacheComponents`, but once Cache Components / Partial Prerendering (PPR) were enabled
(see [ADR-0008](0008-native-i18n-for-cache-components.md)), `next dev` stopped being a
faithful environment to test against:

- **Routes compile lazily.** The dev server compiles a route on its first request. On a
  cold CI runner, that first hit can exceed Playwright's assertion timeout — flaking
  whichever test happens to land first. `e2e/warmup.setup.ts` existed purely to pre-warm
  the `(.)book` intercepting route; it was a band-aid for this.
- **PPR doesn't really run.** Static shells aren't prerendered in dev, so the "shell streams
  instantly, dynamic content streams behind `<Suspense>`" model the app now relies on isn't
  exercised. Hydration timing differs from production.
- **`'use cache'` is loose in dev.** The gallery cache (`GiteSection`, tag `gallery`) behaves
  differently than a built server.

The symptom was classic environment flakiness: a **different** booking test
(`book.spec`, `booking-form`, `booking-lifecycle`) failed on each CI run, all passed in
isolation, and none could be fixed with a test-level change — because the fault was the
test environment, not the tests. These specs were green on `main` (where the pages were
ISR/static via `revalidate`) and only went red once the same pages became request-time
dynamic under Cache Components.

## Decision

On CI, build and serve a **production bundle**: the Playwright `webServer` runs
`next build && next start` when `process.env.CI` is set. Local runs keep `pnpm dev` for
fast iteration (`reuseExistingServer` for an already-running dev server).

```ts
// playwright.config.ts
command: process.env.CI ? "pnpm build && pnpm start" : "pnpm dev",
timeout: 180_000, // a cold-runner production build needs headroom
```

Because `next start` sets `NODE_ENV=production`, the dev-only gallery cache-bust route
(`POST /api/dev/revalidate-gallery`, used by tests that seed `gallery_image` via raw SQL —
outside the Server Actions that would normally `updateTag`) is re-opened with an explicit
`E2E_TESTING` flag set only in the CI e2e job. It stays closed for a real production deploy:

```ts
const isProd = process.env.NODE_ENV === "production";
if (isProd && !process.env.E2E_TESTING) return 403;
```

## Considered options

- **Keep `pnpm dev` + stabilise it** (more warmup routes, fewer workers) — rejected: it only
  papers over lazy compilation and still tests a mode where PPR/`'use cache'` don't run, so it
  validates behaviour the user never sees.
- **Remove the `<Suspense>` streaming from the booking pages** so the form renders eagerly —
  rejected, and it doesn't even build: under Cache Components a request-time read
  (`getBusyIntervals` → `connection()`) accessed outside `<Suspense>` blocks the layout's
  static shell (`"Uncached data accessed outside of <Suspense>"`). The Suspense boundaries are
  load-bearing, not optional.

## Consequences

- E2E now exercises real PPR shells, precompiled routes, and real `'use cache'` — matching
  production, which is the point of an end-to-end test.
- CI e2e is slower by one production build (~1 min); `webServer.timeout` is raised to 180 s.
- `warmup.setup.ts` is no longer compensating for lazy compilation; it's kept as a cheap
  readiness gate (its comment was updated to say so).
- A new env contract: the CI e2e job must set `E2E_TESTING=1`, and the build it runs needs the
  same `DATABASE_URL` / `BETTER_AUTH_*` it already had.
- **Testing gotcha for contributors:** `e2e/global-setup.ts` `TRUNCATE`s core tables and
  `.env.local` points at a live Neon branch — so the suite can only be run safely against a
  disposable database (CI spins up a per-run Neon branch). Don't run it against your dev DB.
