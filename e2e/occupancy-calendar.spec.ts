import { test, expect } from "@playwright/test";
import { neon } from "@neondatabase/serverless";
import { authFile } from "./constants";

test.use({ storageState: authFile });

async function clearBookings() {
  const sql = neon(process.env.DATABASE_URL!);
  await sql`TRUNCATE booking_request`;
}

// Days 10–15 exist in every month, so the seeded spans always fall inside
// the calendar's initial (current) month.
const currentMonth = new Date().toISOString().slice(0, 7);
const bookingStart = `${currentMonth}-10`;
const bookingEnd = `${currentMonth}-15`;
const icalStart = `${currentMonth}-20`;
const icalEnd = `${currentMonth}-24`;

function monthLabel(month: string): string {
  return new Date(`${month}-01T00:00:00Z`).toLocaleDateString("nl-NL", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
}

function shiftMonth(month: string, delta: number): string {
  const [y, m] = month.split("-").map(Number);
  const d = new Date(Date.UTC(y, m - 1 + delta, 1));
  return d.toISOString().slice(0, 7);
}

test.describe("occupancy calendar", () => {
  // clearBookings truncates booking_request, which would race the other
  // booking-seeding specs' all-clear assumptions if interleaved.
  test.describe.configure({ mode: "serial" });

  test.beforeEach(async () => {
    await clearBookings();
  });

  test.afterAll(async () => {
    const sql = neon(process.env.DATABASE_URL!);
    // Only remove the iCal row this spec seeded — ical_source itself is
    // seeded by global-setup and must never be truncated here.
    await sql`DELETE FROM ical_source WHERE id = 'occupancy-ical-1'`;
  });

  test("shows a seeded confirmed booking as a named span in the current month", async ({
    page,
  }) => {
    const sql = neon(process.env.DATABASE_URL!);
    await sql`
      INSERT INTO booking_request (id, name, email, guest_count, locale, start_date, end_date, status, created_at, shown_price_at_booking, address, postal_code, city, country)
      VALUES ('occ-conf-1', 'Sofia Bergström', 'sofia@example.com', 2, 'en', ${bookingStart}, ${bookingEnd}, 'confirmed', now(), 0, 'Teststraat 1', '1234 AB', 'Testdorp', 'NL')
    `;

    await page.goto("/admin");
    await expect(
      page.getByRole("heading", { name: "Bezetting" }),
    ).toBeVisible();

    const calendar = page.getByTestId("occupancy-calendar");
    await expect(calendar).toBeVisible();
    await expect(calendar.getByText(monthLabel(currentMonth))).toBeVisible();
    // Every day slice of the span is a link (accessible name via title), so
    // scope to the first (the labeled start slice).
    await expect(
      calendar.getByRole("link", { name: "Sofia Bergström" }).first(),
    ).toBeVisible();
  });

  test("shows a seeded iCal interval as a grey non-clickable span with the source name", async ({
    page,
  }) => {
    const sql = neon(process.env.DATABASE_URL!);
    await sql`
      INSERT INTO ical_source (id, name, url, enabled, cached_intervals, last_synced_at, created_at, updated_at)
      VALUES (
        'occupancy-ical-1',
        'Occupancy Testbron',
        'https://example.com/occupancy.ics',
        true,
        ${JSON.stringify([{ start: icalStart, end: icalEnd }])}::jsonb,
        now(), now(), now()
      )
      ON CONFLICT (id) DO UPDATE
        SET cached_intervals = EXCLUDED.cached_intervals,
            last_synced_at = now(),
            enabled = true
    `;

    await page.goto("/admin");
    const calendar = page.getByTestId("occupancy-calendar");
    await expect(
      calendar.getByText("Occupancy Testbron").first(),
    ).toBeVisible();
    // iCal spans open nothing — they must not be links.
    await expect(
      calendar.getByRole("link", { name: "Occupancy Testbron" }),
    ).not.toBeVisible();
  });

  test("month navigation moves forward and backward across months", async ({
    page,
  }) => {
    await page.goto("/admin");
    const calendar = page.getByTestId("occupancy-calendar");
    await expect(calendar.getByText(monthLabel(currentMonth))).toBeVisible();

    await calendar.getByRole("button", { name: "Volgende maand" }).click();
    await expect(
      calendar.getByText(monthLabel(shiftMonth(currentMonth, 1))),
    ).toBeVisible();

    await calendar.getByRole("button", { name: "Vorige maand" }).click();
    await calendar.getByRole("button", { name: "Vorige maand" }).click();
    await expect(
      calendar.getByText(monthLabel(shiftMonth(currentMonth, -1))),
    ).toBeVisible();
  });

  test("clicking a booking span opens that booking's detail in the inbox", async ({
    page,
  }) => {
    const sql = neon(process.env.DATABASE_URL!);
    await sql`
      INSERT INTO booking_request (id, name, email, guest_count, locale, start_date, end_date, status, created_at, shown_price_at_booking, address, postal_code, city, country)
      VALUES ('occ-nav-1', 'Mateo Rossi', 'mateo@example.com', 4, 'fr', ${bookingStart}, ${bookingEnd}, 'confirmed', now(), 0, 'Teststraat 1', '1234 AB', 'Testdorp', 'NL')
    `;

    await page.goto("/admin");
    await page
      .getByTestId("occupancy-calendar")
      .getByRole("link", { name: "Mateo Rossi" })
      .first()
      .click();

    await expect(page).toHaveURL(/\/admin\/bookings#booking-occ-nav-1/);
    await expect(page.locator("#booking-occ-nav-1")).toBeVisible();
    await expect(
      page.locator("#booking-occ-nav-1").getByText("Mateo Rossi"),
    ).toBeVisible();
  });

  test("an expired hold does not render as occupying", async ({ page }) => {
    const sql = neon(process.env.DATABASE_URL!);
    await sql`
      INSERT INTO booking_request (id, name, email, guest_count, locale, start_date, end_date, status, confirmed_at, payment_deadline, created_at, shown_price_at_booking, address, postal_code, city, country)
      VALUES (
        'occ-expired-1',
        'Verlopen Gast',
        'verlopen@example.com',
        2, 'nl',
        ${bookingStart}, ${bookingEnd},
        'on_hold',
        now() - interval '10 days',
        (now() - interval '3 days')::date,
        now() - interval '10 days',
        0, 'Teststraat 1', '1234 AB', 'Testdorp', 'NL'
      )
    `;

    await page.goto("/admin");
    const calendar = page.getByTestId("occupancy-calendar");
    await expect(calendar).toBeVisible();
    // The expired hold still appears as an overdue guest action below the
    // calendar, but must not occupy dates in the grid itself.
    await expect(calendar.getByText("Verlopen Gast")).not.toBeVisible();
    await expect(page.getByText("Betaling verlopen")).toBeVisible();
  });
});
