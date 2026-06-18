/**
 * Dev-only script: seeds placeholder iCal sources for local testing.
 * Run with: pnpm seed-ical-sources
 *
 * Uses webcal:// placeholder URLs — replace with real feed URLs in production.
 */
try {
  process.loadEnvFile(".env.local");
} catch {}

const { getDb } = await import("../src/db/index.js");
const { icalSource } = await import("../src/db/schema.js");

const db = getDb();

await db
  .insert(icalSource)
  .values([
    {
      id: crypto.randomUUID(),
      name: "Airbnb",
      url: "webcal://www.airbnb.com/calendar/ical/placeholder.ics",
      enabled: false,
    },
    {
      id: crypto.randomUUID(),
      name: "Natuurhuisje",
      url: "webcal://www.natuurhuisje.nl/calendar/placeholder.ics",
      enabled: false,
    },
  ])
  .onConflictDoNothing();

console.log("Seeded 2 iCal sources (disabled — set real URLs before enabling).");
