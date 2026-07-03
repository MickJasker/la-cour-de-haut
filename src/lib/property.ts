/**
 * Single source of truth for the property's postal address.
 *
 * Consumed by the human-readable footer (`<address>`) and the machine-readable
 * JSON-LD `PostalAddress`. Keeping one constant means the two can't drift — a
 * NAP (name/address) mismatch between visible content and structured data
 * erodes local-SEO trust, so agreement here is structural.
 *
 * Phone and email are NOT here: they're owner-editable via `/admin/settings`
 * (keys `property_telephone` / `property_email`) and read through
 * `getSettings()`. The address stayed in code by product decision — the gîte
 * doesn't move, so it needs no admin field.
 *
 * Plain constants only (no `server-only`). `address` fields map to schema.org
 * `PostalAddress`; `addressCountry` is an ISO 3166-1 alpha-2 code.
 * `addressRegion` is rendered localized (Normandy / Normandië / Normandie) at
 * each call site, so it lives there rather than here.
 */
export const PROPERTY = {
  address: {
    streetAddress: "4 Chem. des Rouillères",
    postalCode: "50520",
    addressLocality: "Juvigny les Vallées",
    addressCountry: "FR",
  },
} as const;
