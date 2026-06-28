# Phone number with country-code combobox, required and stored as E.164

The booking form's phone field becomes a compound control: a searchable country-code combobox (mirroring the existing address `CountryCombobox` — text only, no flags) followed by a local-number input. The two parts are normalized to an **E.164 string** (e.g. `+33612345678`) and written to the existing `phone` text column via the hidden-input pattern (no DB change). Phone is now **required and validated**, which **reverses the "phone optional" decision in ADR-0012**: the owner needs a reachable number to contact the renter quickly in an emergency during the stay, which outweighs the small added inquiry-funnel friction.

Dial codes and validity come from **`libphonenumber-js` (`min` metadata)**, not a hand-maintained table. Each picker row's dial code is derived from `getCountryCallingCode(code)` over the existing `countries.ts` ISO list (dropping codes with no calling code), keeping `countries.ts` the name/ISO authority and the library the dial-code/validity authority. `isValidPhoneNumber` / `parsePhoneNumber` handle per-country national-number rules including the **trunk-prefix problem** — drop France's leading `0`, keep Italy's. A pasted `+`-prefixed international number re-detects and switches the selected country. The picker preselects the locale-implied country with France as the fallback (`LOCALE_DEFAULT_COUNTRY[locale] ?? "FR"`), consistent with the address country field; `en` and unmapped locales fall back to France.

## Considered Options

- **Keep phone optional (status quo per ADR-0012)** — rejected here: emergency reachability during the stay makes a valid number operationally necessary; the address-required / phone-optional asymmetry no longer holds.
- **Hand-maintained dial-code map in `countries.ts`** — rejected: a second source of truth that drifts from the library that actually validates the numbers.
- **Lightweight / no-dependency validation** (strip a leading `0`, length-check) — rejected: wrong for Italy and other trunk-prefix exceptions, and a length check passes typo'd-but-right-length numbers; "required + valid" needs a real definition of valid.
- **Emoji or SVG flags in the picker** — rejected: emoji flags render as letter-boxes on Windows (no flag-emoji font), and SVG flags add weight and diverge from the flag-less address combobox.
- **Duplicate self-contained `COUNTRIES` array (per issue #66)** — rejected: `#89`/ADR-0012 already shipped `cmdk`, `command.tsx`, the Popover+Command pattern, and the ISO list; reuse them instead.

## Consequences

- Adds the `libphonenumber-js` dependency (`min` metadata, ~17KB gzip) to the booking route. It runs on both client (live validation) and server (re-validation in the action), so the shared Zod schema in `src/app/[locale]/book/shared.ts` gains an `isValidPhoneNumber` refine on `phone`.
- Supersedes the "Make `phone` required — rejected" line of ADR-0012; both address and phone are now required.
- The booking form now has **two** `role="combobox"` controls (address country + phone code). Each needs a distinct accessible name, and `e2e/booking-form.spec.ts` must scope `getByRole("combobox", { name })` and fill the local-number input instead of pasting a full `+32…` string into the old plain field.
- No DB migration: the existing `phone` text column stores the E.164 string; the admin inbox and owner email display it (optionally pretty-printed via `formatPhoneNumberIntl`).
