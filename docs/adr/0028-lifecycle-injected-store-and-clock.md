# ADR-0028: `applyTransition` takes an injected store and clock

**Status:** Accepted

## Context

ADR-0026 made `applyTransition` the deep booking-transition module, but it still built its own dependencies: `getDb()` directly (one select, one main write, one compensating rollback write) and the wall clock in two places (`confirmedAt: new Date()` and the argument-less `toUtcDayString()` in the schedule freeze). Its tests had to `vi.mock` eleven modules and could only assert "update was called". "Today"-boundary behaviour was reachable only through Playwright.

`availability.ts` already solved this with `AvailabilityDeps` / `AvailabilityStore`.

## Decision

- **Scope: `lifecycle.ts` only.** `availability.ts`, `machine.ts` and `ical-fetch.ts` already inject. The read-only query modules (`poi-queries`, `page-queries`, `gallery`, `documents`, `lodging-jsonld`, `settings`) stay as they are: thin Drizzle reads with no clock, covered by Playwright.
- **Trailing defaulted param.** `applyTransition(bookingId, action, deps = defaultLifecycleDeps())`. Existing callers are unchanged. `getDb()` is only called inside the Drizzle store's methods at request time, so the lazy build-safe rule holds (never read `DATABASE_URL` at module load).
- **Narrow `LifecycleStore`, not a Drizzle chain.** Three methods: `getBooking`, `saveTransition(id, { status, freeze? })`, `revertTransition(id, { status, clearFrozenSchedule })`. The compensating rollback write moves behind `revertTransition` with no behaviour change: a transition that froze a schedule also clears `confirmedAt` and the snapshot, the others restore status only. Tests use a real in-memory implementation and assert the resulting row.
- **`LifecycleDeps`** bundles the store, the clock, `getSettings`, `isRangeAvailable` and the five email senders.
- **The Drizzle store lives in `lifecycle.ts`.** The ESLint rule from ADR-0026 allows `bookingRequest.status` writes only in that file; a separate store file would trip it.
- **One clock, threaded everywhere.** `deps.clock()` feeds `confirmedAt`, the `confirmDate` of the payment schedule, and the `today` passed to `isExpiredHold` in the late-payment guard. Injecting only `confirmedAt` would leave the deadline maths wall-clock dependent.

## Consequences

- `lifecycle.test.ts` mocks only `next/cache` (`updateTag` is a framework API). Deadline-boundary cases (collapse at the exact deposit/balance deadline edge, a hold due today vs. yesterday) run with a fixed clock in unit tests.
- `Clock` is reused from `availability.ts` rather than redefined.
- `bookings/actions.test.ts` mocks `applyTransition` wholesale; it never touches the seam.
