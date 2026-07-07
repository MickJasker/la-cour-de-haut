# ADR-0021: Two-stage payment schedule with security deposit

**Status:** Accepted

## Context

Until now a confirmed request was a single-payment funnel: `requested → on_hold → confirmed`, where `on_hold` meant "owner confirmed, one bank transfer of the full amount due by an owner-picked deadline" and `confirmed` meant "paid". ADR-0004 releases an unpaid hold lazily once its deadline passes.

The owner wants the real-world booking terms most gîtes use: a **deposit** to secure the dates shortly after confirmation, then the **balance plus a refundable security deposit (borg)** due before arrival. Issue #162 added the pure schedule calculator (`computePaymentSchedule`) and the four settings knobs (`deposit_percentage` / `deposit_deadline_days` / `balance_due_days_before_arrival` / `security_deposit_amount`, defaults 50 / 3 / 7 / 0). Issue #163 (this ADR) wires that schedule through the booking lifecycle, the admin surfaces, the guest email, availability, and the dashboard.

## Decision

A new booking status **`deposit_paid`** sits between `on_hold` and `confirmed`. `confirmed` keeps its meaning: **fully paid**. The transition table:

```
requested
  ─(confirm)→ on_hold           [deposit due, auto-expires per ADR-0004]
  ─(decline)→ declined
on_hold
  ─(mark_deposit_paid)→ deposit_paid   [balance + borg due, arrival − N days]
  ─(mark_paid)→ confirmed              [collapse path only — single payment]
  ─(cancel)→ cancelled
deposit_paid
  ─(mark_balance_paid)→ confirmed
  ─(cancel)→ cancelled
confirmed
  ─(cancel)→ cancelled
```

The state machine (`src/lib/booking/machine.ts`) is the single source of these rules; every surface reads it rather than re-encoding transitions.

### The deposit secures the dates; only the deposit deadline auto-expires

Lazy auto-expiry (ADR-0004, no cron) applies **only** to `on_hold` past its deposit deadline. `isExpiredHold` is unchanged — it still keys off `on_hold` + `paymentDeadline`, and `paymentDeadline` doubles as the deposit deadline. `expired` remains a **derived display status, never stored**, computed only from `on_hold` + deposit deadline.

A missed **balance** deadline never releases the dates: `deposit_paid` blocks dates like `confirmed` (busy-intervals and the outbound iCal feed treat both, plus non-expired `on_hold`, as active). An overdue balance instead surfaces in the dashboard **overdue** list for the owner to chase; cancelling is then a manual decision.

### Snapshot at confirm

On confirm, the lifecycle computes the schedule via `computePaymentSchedule` from the **frozen** price (`shownPriceAtBooking`, submit-time), the current borg, the confirm date, and the guest's arrival — then freezes it onto the booking (same philosophy as `shownPriceAtBooking`). Later settings edits never alter an in-flight booking. The owner **no longer picks a deadline**; the confirm dialog shows the computed schedule as a read-only preview of what the guest will be emailed.

Snapshot columns on `booking_request` (all nullable until confirm):

- `payment_collapsed` — discriminator: `true` = single payment, `false` = two-stage.
- `deposit_amount` — the amount due at `payment_deadline`: the deposit (two-stage) or the full 100% + borg (collapsed).
- `balance_amount` / `balance_deadline` — the balance (incl. borg) and its deadline; **NULL when collapsed**.
- `security_deposit_at_booking` — the borg frozen at confirm (0 when none).
- `payment_deadline` (existing) — reused as the deposit deadline (two-stage) or the single deadline (collapsed), so ADR-0004 expiry needs no change.

`scheduleToSnapshot` (schedule → columns) and `bookingPaymentSchedule` (columns → schedule) in `payment-schedule.ts` are the single round-trip; every reader (admin UI, dashboard, and the wave-3 receipt/cancel emails) reconstructs the schedule through `bookingPaymentSchedule` rather than reading the raw columns.

### Collapse path (short notice)

When the balance deadline would fall on or before the deposit deadline, `computePaymentSchedule` collapses the schedule to one payment of 100% + borg (issue #162). The guest owes a single transfer, and a single **mark-paid** action moves `on_hold` straight to `confirmed`. The admin UI offers `mark_deposit_paid` vs the single `mark_paid` based on `payment_collapsed`; a legacy `on_hold` with no snapshot is treated as collapsed (matches the backfill below).

### Bank-transfer email

The email (`bank-transfer-email.ts`) presents the schedule in all four locales: two instalments (deposit amount + deadline; balance + borg amount + deadline) or the single collapsed amount. The two transfers carry **distinct payment references** so the owner can reconcile them. A send failure still rolls the confirm back (status restored, snapshot cleared) — a confirm never reports success without the instructions actually going out.

### Migration honors what was emailed

The migration adds the enum value and columns, then backfills every existing `on_hold` / `confirmed` row as a **collapsed single-payment** booking: `payment_collapsed = true`, borg €0, the single amount equal to the total the guest was already quoted (computed in SQL mirroring `calculatePriceBreakdown` — discounted rental + tourism tax), still due by their existing `payment_deadline`. No guest ends up with terms differing from the email they received. The backfill only touches rows whose snapshot is still NULL, so it is safe to re-run.

## Consequences

- One new intermediate status and five nullable columns; no change to the ADR-0004 expiry predicate or to how dates are blocked (status-derived).
- The owner loses manual control of the deadline in exchange for a consistent, settings-driven schedule; the confirm dialog previews it so there is no surprise.
- The collapsed convention overloads `deposit_amount` to hold the single total. This is deliberately hidden behind `bookingPaymentSchedule` — callers see a clean `PaymentSchedule`, never the raw column.
- The SQL backfill reproduces JS float arithmetic in Postgres `numeric`; sub-cent divergence is possible in principle but never crosses a rounding boundary at these magnitudes, and the site had no real two-stage bookings before this change.
</content>
