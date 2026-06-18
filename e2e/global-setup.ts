import { spawnSync } from "child_process";
import { neon } from "@neondatabase/serverless";

export default async function globalSetup() {
  const dbUrl = process.env.DATABASE_URL;
  if (!dbUrl)
    throw new Error("DATABASE_URL must be set before running E2E tests");

  // Apply any pending migrations
  const migrate = spawnSync("pnpm", ["db:migrate"], {
    stdio: "inherit",
    env: process.env,
  });
  if (migrate.status !== 0) throw new Error("pnpm db:migrate failed");

  // Wipe all data for a deterministic starting state
  const sql = neon(dbUrl);
  await sql`TRUNCATE "user", session, account, verification, ical_source, booking_request CASCADE`;

  // Seed the owner account with known credentials
  const seed = spawnSync("pnpm", ["seed-owner"], {
    stdio: "inherit",
    env: process.env,
  });
  if (seed.status !== 0) throw new Error("pnpm seed-owner failed");

  // Seed a test iCal source with pre-cached intervals so no network fetch is
  // needed during tests. Dates are fixed far in the future to avoid flakiness.
  await sql`
    INSERT INTO ical_source (id, name, url, enabled, cached_intervals, last_synced_at, created_at, updated_at)
    VALUES (
      'test-ical-source',
      'Test Source',
      'https://example.com/test.ics',
      true,
      '[{"start":"2027-07-10","end":"2027-07-15"}]',
      now(),
      now(),
      now()
    )
  `;
}
