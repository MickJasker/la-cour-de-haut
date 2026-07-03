/**
 * Seeds the required property contact settings (`property_telephone`,
 * `property_email`) with their initial values.
 *
 * These two settings are **required** (the admin settings form won't save while
 * either is blank) and there is no code-level fallback, so a fresh deploy must
 * have them present before the app serves a page — otherwise the header would
 * render empty `tel:`/`mailto:` links and the JSON-LD would omit the fields.
 *
 * That's why this is chained into `db:migrate` (which runs inside `pnpm build`)
 * rather than being a manual one-off like `seed-owner` / `seed-ical-sources`.
 * It is idempotent: `onConflictDoNothing` means it only ever fills a MISSING
 * key, so re-running on every deploy never clobbers a value the owner later
 * edited in `/admin/settings`.
 *
 * Only issues INSERT (no DDL), so the pooled `DATABASE_URL` is fine.
 *
 * Run with: pnpm seed-property-settings
 */
try {
  process.loadEnvFile(".env.local");
} catch {}

const { getDb } = await import("../src/db/index.js");
const { setting } = await import("../src/db/schema.js");

const db = getDb();

const SEED = [
  { key: "property_telephone", value: "+33673100889" },
  { key: "property_email", value: "info@lacourdehaut.fr" },
];

const result = await db
  .insert(setting)
  .values(SEED)
  .onConflictDoNothing({ target: setting.key })
  .returning({ key: setting.key });

console.log(
  `Property settings seed: ${result.length} of ${SEED.length} inserted ` +
    `(${SEED.length - result.length} already present, left untouched).`,
);
