import { test, expect } from "@playwright/test";
import { neon } from "@neondatabase/serverless";

const TOKEN = "a".repeat(64); // fixed known value for seeding

async function clearTokens() {
  const sql = neon(process.env.DATABASE_URL!);
  await sql`TRUNCATE ical_export_token`;
}

async function seedToken() {
  const sql = neon(process.env.DATABASE_URL!);
  await sql`
    INSERT INTO ical_export_token (id, name, token, created_at)
    VALUES ('export-tok-1', 'Test Platform', ${TOKEN}, now())
    ON CONFLICT (id) DO NOTHING
  `;
}

async function clearTestBookings() {
  const sql = neon(process.env.DATABASE_URL!);
  await sql`DELETE FROM booking_request WHERE id LIKE 'ical-test-%'`;
}

async function clearAllBookings() {
  const sql = neon(process.env.DATABASE_URL!);
  await sql`TRUNCATE booking_request`;
}

test.describe("iCal export feed", () => {
  test.describe.configure({ mode: "serial" });

  test.beforeEach(async () => {
    await clearTokens();
    await seedToken();
    await clearTestBookings();
  });

  test.afterEach(async () => {
    await clearTokens();
    await clearTestBookings();
  });

  test("unknown token returns 404", async ({ request }) => {
    const res = await request.get("/api/ical/unknowntoken.ics");
    expect(res.status()).toBe(404);
  });

  test("valid token returns text/calendar response", async ({ request }) => {
    const res = await request.get(`/api/ical/${TOKEN}.ics`);
    expect(res.status()).toBe(200);
    expect(res.headers()["content-type"]).toContain("text/calendar");
  });

  test("empty feed is a valid VCALENDAR with no VEVENTs", async ({
    request,
  }) => {
    // Truncate all bookings immediately before this check — prefix-based
    // cleanup misses rows seeded by parallel booking-lifecycle workers.
    await clearAllBookings();
    const res = await request.get(`/api/ical/${TOKEN}.ics`);
    const body = await res.text();
    expect(body).toContain("BEGIN:VCALENDAR");
    expect(body).toContain("END:VCALENDAR");
    expect(body).not.toContain("BEGIN:VEVENT");
  });

  test("confirmed booking appears as VEVENT with no guest PII", async ({
    request,
  }) => {
    const sql = neon(process.env.DATABASE_URL!);
    await sql`
      INSERT INTO booking_request (id, name, email, guest_count, locale, start_date, end_date, status, confirmed_at, payment_deadline, created_at, shown_price_at_booking, address, postal_code, city, country)
      VALUES ('ical-test-confirmed', 'Anna Schmidt', 'anna@example.com', 2, 'de', '2028-06-01', '2028-06-08', 'confirmed', now(), now()::date, now(), 0, 'Teststraat 1', '1234 AB', 'Testdorp', 'NL')
    `;

    const res = await request.get(`/api/ical/${TOKEN}.ics`);
    const body = await res.text();

    expect(body).toContain("BEGIN:VEVENT");
    expect(body).toContain("DTSTART;VALUE=DATE:20280601");
    expect(body).toContain("DTEND;VALUE=DATE:20280608");
    expect(body).toContain("SUMMARY:Booked");
    // No guest name, email, or count
    expect(body).not.toContain("Anna");
    expect(body).not.toContain("anna@");
  });

  test("live on_hold booking appears as VEVENT", async ({ request }) => {
    const sql = neon(process.env.DATABASE_URL!);
    const futureDeadline = new Date();
    futureDeadline.setDate(futureDeadline.getDate() + 7);
    const deadline = futureDeadline.toISOString().slice(0, 10);

    await sql`
      INSERT INTO booking_request (id, name, email, guest_count, locale, start_date, end_date, status, confirmed_at, payment_deadline, created_at, shown_price_at_booking, address, postal_code, city, country)
      VALUES ('ical-test-hold-live', 'Marie Dupont', 'marie@example.com', 2, 'fr', '2028-07-01', '2028-07-08', 'on_hold', now(), ${deadline}::date, now(), 0, 'Teststraat 1', '1234 AB', 'Testdorp', 'NL')
    `;

    const res = await request.get(`/api/ical/${TOKEN}.ics`);
    const body = await res.text();

    expect(body).toContain("DTSTART;VALUE=DATE:20280701");
    expect(body).toContain("DTEND;VALUE=DATE:20280708");
  });

  test("expired on_hold booking (past payment deadline) is absent from the feed", async ({
    request,
  }) => {
    const sql = neon(process.env.DATABASE_URL!);
    await sql`
      INSERT INTO booking_request (id, name, email, guest_count, locale, start_date, end_date, status, confirmed_at, payment_deadline, created_at, shown_price_at_booking, address, postal_code, city, country)
      VALUES ('ical-test-hold-expired', 'Luca Rossi', 'luca@example.com', 2, 'it', '2028-08-01', '2028-08-08', 'on_hold', now() - interval '10 days', (now() - interval '2 days')::date, now() - interval '10 days', 0, 'Teststraat 1', '1234 AB', 'Testdorp', 'NL')
    `;

    const res = await request.get(`/api/ical/${TOKEN}.ics`);
    const body = await res.text();

    expect(body).not.toContain("20280801");
  });

  test("declined and cancelled bookings are absent from the feed", async ({
    request,
  }) => {
    const sql = neon(process.env.DATABASE_URL!);
    await sql`
      INSERT INTO booking_request (id, name, email, guest_count, locale, start_date, end_date, status, created_at, shown_price_at_booking, address, postal_code, city, country)
      VALUES
        ('ical-test-declined',   'Guest A', 'a@example.com', 1, 'nl', '2028-09-01', '2028-09-08', 'declined',   now(), 0, 'Teststraat 1', '1234 AB', 'Testdorp', 'NL'),
        ('ical-test-cancelled',  'Guest B', 'b@example.com', 1, 'nl', '2028-10-01', '2028-10-08', 'cancelled',  now(), 0, 'Teststraat 1', '1234 AB', 'Testdorp', 'NL')
    `;

    const res = await request.get(`/api/ical/${TOKEN}.ics`);
    const body = await res.text();

    expect(body).not.toContain("20280901");
    expect(body).not.toContain("20281001");
  });

  test("multiple bookings each produce a VEVENT", async ({ request }) => {
    const sql = neon(process.env.DATABASE_URL!);
    const futureDeadline = new Date();
    futureDeadline.setDate(futureDeadline.getDate() + 7);
    const deadline = futureDeadline.toISOString().slice(0, 10);

    await sql`
      INSERT INTO booking_request (id, name, email, guest_count, locale, start_date, end_date, status, confirmed_at, payment_deadline, created_at, shown_price_at_booking, address, postal_code, city, country)
      VALUES
        ('ical-test-multi-1', 'Guest One', 'one@example.com', 2, 'nl', '2029-03-01', '2029-03-08', 'confirmed', now(), now()::date, now(), 0, 'Teststraat 1', '1234 AB', 'Testdorp', 'NL'),
        ('ical-test-multi-2', 'Guest Two', 'two@example.com', 2, 'nl', '2029-04-01', '2029-04-08', 'on_hold',   now(), ${deadline}::date, now(), 0, 'Teststraat 1', '1234 AB', 'Testdorp', 'NL'),
        ('ical-test-multi-3', 'Guest Three', 'three@example.com', 2, 'nl', '2029-05-01', '2029-05-08', 'confirmed', now(), now()::date, now(), 0, 'Teststraat 1', '1234 AB', 'Testdorp', 'NL')
    `;

    const res = await request.get(`/api/ical/${TOKEN}.ics`);
    const body = await res.text();

    expect(body).toContain("DTSTART;VALUE=DATE:20290301");
    expect(body).toContain("DTSTART;VALUE=DATE:20290401");
    expect(body).toContain("DTSTART;VALUE=DATE:20290501");
    expect((body.match(/BEGIN:VEVENT/g) ?? []).length).toBe(3);
  });

  test("successful request writes lastAccessedAt to the token row", async ({
    request,
  }) => {
    await request.get(`/api/ical/${TOKEN}.ics`);

    // Allow a moment for the fire-and-forget write to land
    await new Promise((r) => setTimeout(r, 500));

    const sql = neon(process.env.DATABASE_URL!);
    // Verify the write happened by checking the row was updated within the last minute
    const rows = await sql`
      SELECT id FROM ical_export_token
      WHERE token = ${TOKEN}
        AND last_accessed_at > now() - interval '1 minute'
    `;
    expect(rows.length).toBe(1);
  });
});
