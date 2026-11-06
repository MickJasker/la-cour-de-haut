# ADR-0026: `applyTransition` is one deep module; the transition table is private

**Status:** Accepted (implemented in two PRs, see Delivery)

## Context

The booking state machine (`machine.ts`) read as the enforcement gate, but the real depth lived in `applyTransition` (`lifecycle.ts`): the conflict check, the bank-details precondition, schedule freezing, and five hand-copied "send email, roll back on failure" blocks. Its interface `(id, action) => Promise<void>` advertised none of it, while the module named "machine" — a lookup table plus two helpers — was the shallow one.

## Decision

- **`lifecycle.ts` is the deep module.** The transition table, `transition()` and `canTransition` are private to it (`canTransition` had no non-test users). `machine.ts` keeps only the display helpers (`DisplayStatus`, `toDisplayStatus`, `isExpiredHold`, `isPastCheckout`). Tests exercise transitions through `applyTransition`.
- **One table-driven email mechanism.** Each table entry declares its `nextStatus` and a `prepare(booking)` step that validates preconditions and returns `{ send, frozenSchedule? }`. `applyTransition` runs one write → send → compensate path for every action. Rollback restores the previous status, and additionally clears `confirmedAt` and the frozen schedule only when the transition froze one.
- **Synchronous send with compensating rollback is kept.** Transitions are owner-triggered, so failure is visible and retryable, and a confirm must never report success without the payment instructions having gone out.
- **Accepted crash window.** neon-http has no interactive transactions, so the status write and the email send are not atomic: a process crash between them leaves the new status with no email sent. Accepted for a single-owner, low-volume site.
- **Failure contract (PR 2).** `applyTransition` will return `{ ok: true } | { ok: false, reason: "invalid_transition" | "dates_taken" | "bank_details_missing" }`; `LatePaymentDatesTakenError` folds into `dates_taken`. Lifecycle bugs and email-transport failures stay thrown.
- **Bypass prevention (PR 2).** An ESLint `no-restricted-syntax` rule forbids `status` in a `bookingRequest` `.set({...})` outside `lifecycle.ts`. No DB trigger: e2e specs seed rows in arbitrary statuses with raw SQL.
- **Cache ownership (PR 2).** `applyTransition` owns `updateTag(CACHE_TAGS.icalExport)` as a documented post-condition (ADR-0024), which makes it Server-Action-only. Actions keep `revalidatePath("/admin/bookings")`.

## Delivery

1. Behavior-preserving deepening (table private, one email mechanism, `machine.ts` trimmed, this ADR).
2. Behavior changes (result type, `updateTag` move, ESLint rule, e2e per failure reason).

## Consequences

- The interface documents preconditions, failure modes and post-conditions in one place; adding an action means adding one table entry.
- The no-op `blockInFeed` / `releaseFromFeed` side-effect flags are dropped: availability derives from DB status, so the status write is the feed change.
