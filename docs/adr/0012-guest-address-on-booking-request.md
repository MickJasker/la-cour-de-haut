# Collect guest postal address on the booking request

Booking requests now capture the guest's postal address (street + house number, postal code, city, country) on the public inquiry form, all required. The address is primarily needed for the rental contract and the owner's records — which only matter once a request is confirmed — but it is collected **up-front at inquiry time** because it also serves as a serious-inquiry / fraud filter, and that only works _before_ the owner invests time replying.

`country` is stored as an **ISO 3166-1 alpha-2 code** (not free text) and rendered per-surface via `Intl.DisplayNames`: the guest's active locale on the form, the owner's locale (Dutch) in the admin inbox and the owner notification email. Storing the code keeps records canonical across the four guest languages (NL/FR/DE/EN), where free text would yield "Nederland" / "Pays-Bas" / "Niederlande" / "Netherlands" for one country. The combobox preselects the country implied by the guest's locale (`nl→NL`, `fr→FR`, `de→DE`; `en→`none).

Columns are `NOT NULL` with no default — safe because `booking_request` is empty in production, so there are no pre-feature rows to backfill. Validation is non-empty + length caps (no per-country postal-code regex); the owner's eyeball review at confirmation is the real "verification".

## Considered Options

- **Free-text country** — rejected: inconsistent, un-groupable records across four guest languages; degrades the legal/records purpose.
- **Collect at confirmation instead of inquiry** — rejected: defeats the fraud-filter purpose, which requires the address before the owner replies.
- **Make `phone` required for symmetry** — rejected: left optional (email is the primary contact channel); the address/phone asymmetry is accepted.
- **Per-country postal-code format validation** — rejected: brittle regex tables that risk rejecting valid foreign addresses.

## Consequences

- Adds the `cmdk` dependency and a `src/components/ui/command.tsx` primitive (the shadcn Combobox is Popover + Command).
- The combobox value must be submitted into `FormData` (the hidden-input pattern already used for `stayDates`) so server-side validation sees `country`.
- The privacy policy's collected-data list and purpose text were extended in all four locales to keep the GDPR Art. 13 disclosure accurate.
