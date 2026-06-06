# ADR-0001: Block dates on owner confirm, not on payment

**Status:** Accepted

## Context

The site has no online payment. When the owner confirms a booking request, there is a gap of up to several days before the guest pays by bank transfer. During that gap, the export feed either shows the dates as unavailable (blocking them on Airbnb/Natuurhuisje) or leaves them open.

Blocking on payment would be cleaner — no phantom holds — but iCal polling latency means platforms may not update for hours after the status changes. A double-booking could be confirmed on a platform before the feed catches up.

## Decision

Block on confirm. Dates enter the outbound export feed the moment the owner sets status to `on_hold`. The hold auto-expires if payment is not received by the payment deadline, releasing the dates from the feed at that point.

## Consequences

- Unpaid holds briefly remove dates from availability; expiry releases them lazily on read.
- Platforms start blocking dates immediately on confirm, minimising the double-booking window.
- The owner must set a payment deadline and communicate it clearly to the guest.
- No cron job is required to enforce expiry — lazy checking on read is sufficient.
