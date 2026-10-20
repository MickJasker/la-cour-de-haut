# ADR-0004: Lazy hold expiry — no scheduled cron at launch

**Status:** Accepted

## Context

`on_hold` bookings that pass their payment deadline must have their dates released from the export feed. This can be enforced either by a scheduled job that sweeps expired holds, or lazily when availability is read.

A Vercel Cron job would guarantee prompt expiry but adds infrastructure and consumes the free tier's cron allowance.

## Decision

Hold expiry is checked lazily. When the availability calendar is rendered, the outbound iCal feed is requested, or any inbox query is run, expired holds are filtered out at query time (status `on_hold` where `payment_deadline < now()`). No cron job is required at launch.

## Consequences

- Simpler infrastructure; no Vercel Cron configuration needed.
- Dates are released from the export feed as soon as any read triggers the expiry check — in practice within minutes, since platforms poll the feed regularly.
- If guaranteed prompt expiry is ever required (e.g. owner wants a nightly sweep with an email notification), a single daily cron job can be added without any schema changes.

## Addendum: an expired hold is not terminal

An expired hold can still be marked paid as a **late payment** (the normal mark-paid actions: collapsed → `confirmed`, two-stage → `deposit_paid`). Because its dates were already released, the transition first checks `isRangeAvailable` for the stay, and only for an expired hold. No self-exclusion is needed, because expired holds are already left out of busy intervals. If anything has claimed the dates in the meantime, the payment is refused before any write or email, so a revived hold can never double-book them. On-time payments skip the check. The frozen payment schedule is left as it is.
