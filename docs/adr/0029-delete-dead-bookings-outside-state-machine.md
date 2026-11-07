# 0029 — Hard-delete dead bookings, outside the state machine

## Status

Accepted (issue #187)

## Context

Declined, cancelled, and expired bookings pile up in `/admin/bookings`. The owner needs a way to remove them.

## Decision

- **Hard delete** the `booking_request` row. Nothing references it by FK, terminal rows never reach busy intervals or the iCal export, and purging personal data of guests who never stayed favours GDPR data minimisation.
- **Eligible:** `declined`, `cancelled`, and expired holds (`on_hold` past `paymentDeadline`, ADR-0004). Past _confirmed_ stays are revenue/guest history and stay undeletable.
- **Delete is not a transition.** Cancel/decline are `TRANSITIONS` with side effects (emails, feed release). Delete is record removal on an already-terminal row, so `deleteBookingAction` does not go through `applyTransition` and is not in `machine.ts`'s transition map. Eligibility is the pure predicate `isDeletableBooking`, which the server action re-evaluates against the DB row and a fresh `today` — the client's displayed status is never trusted.
- Per-booking only, behind a confirm dialog. No bulk sweep, no auto-retention (possible follow-up).

## Consequences

- No audit trail of deleted bookings (no soft-delete flag), by design.
- Expired holds keep their "mark paid"/cancel actions next to Delete, since a late payment is still recordable until the owner removes the row.
