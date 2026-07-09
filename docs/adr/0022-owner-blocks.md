# ADR-0022: Owner blocks as a dedicated table

**Status:** Accepted

## Context

The iCal echo filter (#177, #178) makes platforms self-filter their own re-exported bookings: Airbnb marks a block `Airbnb (Not available)`, Natuurhuisje marks one `Blokkade <id> natuurhuisje`, and inbound parsing skips both so a stay never double-counts across sources (see CONTEXT.md's "iCal sync" section). The filter cannot tell a re-exported echo of our own booking apart from an owner _manually_ blocking dates inside that platform's own calendar UI — both arrive with the same block `SUMMARY`. Consequence: **manually blocking dates inside Airbnb or Natuurhuisje no longer blocks the site.** Three ranges the owner had blocked this way are currently bookable on the public site with no in-app way to re-create them.

The app must therefore become the source of truth for owner-side blocks: a way to mark dates unavailable (own stay, maintenance, a platform outage, …) that lives in this app and propagates outward, rather than being read in from a platform.

## Decision

### A dedicated `owner_block` table, not a `booking_request` status

```
owner_block
  id          text PK
  start_date  date NOT NULL
  end_date    date NOT NULL   -- exclusive, RFC 5545 convention like all intervals
  label       text            -- optional, admin-private (e.g. "eigen verblijf")
  created_at  timestamp
```

Rejected: encoding a block as a new `booking_request` status. `booking_request` has ~10 `NOT NULL` guest columns (name, email, guest count, address, …) that a block has no values for — every one would need a dummy placeholder. The status would also need carve-outs everywhere `booking_request` is read: the state machine (`machine.ts`), the inbox, the display-status mapping, and the confirmation/decline emails, none of which make sense for something that isn't a guest inquiry.

A second table is normally the more expensive option — it's a second source callers must remember to merge. That cost was already paid by the iCal work: availability reads flow through three centralized seams, and each gains owner blocks as a small, local change rather than a new caller-by-caller merge:

1. `getBusyIntervals` (`src/lib/booking/availability.ts`) — blocks count as busy for the public calendar, the submit-time re-check, and the confirm-conflict guard **automatically**, with no change at any call site
2. the outbound export route (`/api/ical/[token]`) — blocks are exported so platforms block the dates too (see the export decision below)
3. `computeOccupancyEntries` (`src/lib/booking/occupancy-calendar.ts`) — gains a third `OccupancyEntry` kind (`block`) rendered on the admin grid

Owner blocks also have no lifecycle: a `booking_request` moves through `requested → on_hold → deposit_paid → confirmed` (ADR-0021) with expiry, cancellation, and decline paths; a block simply exists or doesn't. There is nothing here for a status enum to model — past blocks just age out of view once their dates pass.

### No hard conflict guard — silent overlap with bookings, warn on pending requests

A block only ever _adds_ busyness to `getBusyIntervals`; it can never be the cause of a double booking, so it needs no conflict guard as strict as the one between two bookings:

- **Overlap with an active booking** (`on_hold` / `deposit_paid` / `confirmed`): saves **silently**. Forbidding it would force the owner to hand-split a block around an existing stay (e.g. blocking a whole month that happens to contain a confirmed week) for no safety benefit — the booking's dates were already busy.
- **Overlap with a pending `requested` inquiry**: shows a **warning** listing the affected requests with links to decline them, but still allows saving. Once the block is saved, that inquiry can never be confirmed — the confirm-conflict guard reads the same `getBusyIntervals`, so the block silently forecloses it. Blocking anyway (with the warning surfaced) beats forbidding it outright, since the owner may be blocking dates specifically _because_ they've decided to decline those requests.
- **Overlap with another block**: allowed; blocks may overlap and their intervals simply merge in `getBusyIntervals`.

### Inclusive range in the UI, exclusive end in storage

The owner selects a range by clicking a start day and an end day on the occupancy calendar; both clicked days are blocked — "these days are unavailable," not check-in/check-out semantics like a booking. Storage still uses an **exclusive** `end_date` (`end = last blocked day + 1`), matching every other interval in the system (RFC 5545, `booking_request.end_date`, iCal `DTEND`). This is a pure input-boundary conversion: `expandInterval`, `hasConflict`, and the export route all already expect exclusive-end intervals and need no change to accept blocks. A guest may still arrive on the day _after_ the last blocked day — the exclusive end is what makes that same-day turnover possible, exactly as it does for bookings.

### Export as `SUMMARY:Not available`, self-filtering by construction

```
BEGIN:VEVENT
UID:block-{id}@lacourdehaut.fr
DTSTART;VALUE=DATE:20260730
DTEND;VALUE=DATE:20260814
SUMMARY:Not available
END:VEVENT
```

The private `label` is **never** exported — it only ever appears in the admin UI.

The `SUMMARY` text is not arbitrary. Airbnb and Natuurhuisje currently rewrite summaries on re-export (they emit their own `Airbnb (Not available)` / `Blokkade <id> natuurhuisje`, already caught by the inbound echo filter — see #177/#178). But nothing guarantees every future platform will behave the same way; a platform that re-exports **verbatim** would echo our own block straight back at us unchanged. `Not available` is chosen deliberately to match the inbound echo-filter regex (`/not available|blokkade/i`): a verbatim echo of our own block's `SUMMARY` is filtered exactly like a rewritten one, so it can never re-import as a phantom busy interval regardless of how a given platform's re-export happens to behave. The export text and the import filter are two ends of the same guarantee, kept in sync by construction rather than by a platform-specific assumption.

## Consequences

- One new table with no lifecycle, plus three small, local additions to the existing centralized availability seams (`getBusyIntervals`, the export route, `computeOccupancyEntries`) — no change to the `booking_request` state machine, guest-facing emails, or the inbox.
- The owner can create a block that quietly overlaps a confirmed stay or leaves a pending inquiry unconfirmable; both are treated as acceptable (the former is inert, the latter is surfaced with a warning and a decline link) rather than blocked outright, trading a stricter guard for not forcing manual date gymnastics.
- Blocking dates on a platform's own calendar remains permanently ineffective on this site — the echo filter can't distinguish "owner clicked block on Airbnb" from "Airbnb echoed our booking." Owner blocks exist specifically so the owner has a working alternative in the one place (this app) that isn't subject to that ambiguity.
- The export `SUMMARY` wording is now a load-bearing constant, not a display detail: changing it would break the self-filtering guarantee for verbatim-re-exporting platforms. It must stay in sync with the inbound echo-filter regex if either ever changes.
