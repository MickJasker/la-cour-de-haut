# Guest IBAN on the booking request, for security-deposit returns

The booking form gains an **`iban`** field, shown and required only when a security deposit (borg) applies (`paymentConfig.securityDeposit > 0`, the same value already used for the payment-schedule preview). The owner reported trouble matching an incoming bank transfer to the right guest when returning the borg after a stay, since the sender's IBAN isn't always clearly attributable in their bank app; capturing it up front removes that friction (issue #195).

Validity is checked with **`ibantools`** (checksum + per-country format), the same "real library, not a bare regex" standard `libphonenumber-js` set for the `phone` field (ADR-0013). The raw value is normalized to its canonical electronic format (`electronicFormatIBAN` — uppercase, no spaces) before it's written to a new nullable `iban` text column on `booking_request`; nullable because the field is only conditionally required, mirroring the existing nullable `phone` column.

The "is a deposit configured" condition is derived **independently on both sides**: `book-form.tsx` reads `paymentConfig.securityDeposit` (fetched server-side) for the client validator and to decide whether to render the field at all, while `action.ts`'s `onServerValidate` re-reads `securityDepositAmount` from settings itself rather than trusting anything the client submitted — a crafted request can't skip the required check by claiming no deposit applies. When the field isn't shown, the form still submits an empty `iban` via a hidden input (rather than omitting the form control entirely), because the shared Zod schema in `shared.ts` expects the key to always be present — only its content is conditionally validated.

The field is displayed in the admin bookings page's existing guest-contact block, unconditionally whenever present.

## Considered Options

- **Collect the IBAN later** (once the booking reaches `deposit_paid`/`confirmed`, via a follow-up step) — rejected: the client's request was specifically for the inquiry-form field, and the volume of inquiries that never confirm is not large enough to justify a second collection surface for this gîte.
- **IBAN + a separate account-holder-name field** — rejected: SEPA transfers don't require the sender/recipient names to match, and the owner already has email/phone to resolve the rare case where the account holder differs from the guest.
- **Bare regex validation** (country prefix + length) — rejected in favor of `ibantools`'s full checksum validation, consistent with how `phone` already uses a real validation library rather than a shape check.
- **Also add a "borg returned" tracking status/action** — rejected as out of scope for this issue. It would add a new state to the booking lifecycle and a new admin action; the owner still does the actual return transfer manually and outside the system, same as before this change. A tracking workflow, if ever wanted, is its own feature with its own design decisions.
- **Clear the IBAN once the borg is returned** (data minimization) — rejected: this app has no retention/deletion tooling for any other booking field, and adding one just for `iban` would be new scope; it's retained indefinitely with the rest of the record, like `phone`/`address`.

## Consequences

- Adds the `ibantools` dependency.
- New nullable `iban` column on `booking_request` (migration `drizzle/0023_sour_queen_noir.sql`).
- `createBookingFormSchema` (`src/app/[locale]/book/shared.ts`) takes a new `{ requireIban }` option; both `book-form.tsx` and `action.ts` compute it from `securityDepositAmount`/`paymentConfig.securityDeposit` rather than sharing a single boolean across the client/server boundary.
- The booking form always submits an `iban` form value (hidden input when the field isn't shown), so the server never sees the key as entirely absent.
- Admin bookings page (`src/app/admin/(private)/bookings/page.tsx`) shows the IBAN in the guest contact block when present; no other surface (e.g. the owner-notification email) was extended.
- This is a more sensitive field than the other guest-contact data already on `booking_request`. The owner-managed privacy page (ADR-0020) should be updated to disclose the new data collection — that's a content change made by the owner in `/admin`, not a code change, and isn't automated by this ADR.
