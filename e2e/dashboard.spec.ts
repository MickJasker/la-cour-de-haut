import { test, expect } from "@playwright/test";
import { neon } from "@neondatabase/serverless";
import { authFile } from "./constants";

test.use({ storageState: authFile });

async function clearBookings() {
  const sql = neon(process.env.DATABASE_URL!);
  await sql`TRUNCATE booking_request`;
}

test.describe("dashboard", () => {
  test.describe.configure({ mode: "serial" });

  test.beforeEach(async () => {
    await clearBookings();
  });

  test("shows all-clear state when no actions are pending", async ({
    page,
  }) => {
    await page.goto("/admin");
    await expect(page.getByText("Alles in orde")).toBeVisible();
    await expect(
      page.getByRole("heading", { name: "Openstaande acties" }),
    ).not.toBeVisible();
  });

  test("shows new request in openstaande acties", async ({ page }) => {
    const sql = neon(process.env.DATABASE_URL!);
    await sql`
      INSERT INTO booking_request (id, name, email, guest_count, locale, start_date, end_date, status, created_at, shown_price_at_booking, address, postal_code, city, country)
      VALUES ('dash-req-1', 'Emma Leclerc', 'emma@example.com', 3, 'fr', '2028-07-01', '2028-07-08', 'requested', now(), 0, 'Teststraat 1', '1234 AB', 'Testdorp', 'NL')
    `;

    await page.goto("/admin");
    await expect(
      page.getByRole("heading", { name: "Openstaande acties" }),
    ).toBeVisible();
    await expect(page.getByText("Emma Leclerc")).toBeVisible();
    await expect(page.getByText("Nieuw verzoek")).toBeVisible();
    await expect(page.getByText("Alles in orde")).not.toBeVisible();
  });

  test("shows overdue payment in openstaande acties", async ({ page }) => {
    const sql = neon(process.env.DATABASE_URL!);
    await sql`
      INSERT INTO booking_request (id, name, email, guest_count, locale, start_date, end_date, status, confirmed_at, payment_deadline, created_at, shown_price_at_booking, address, postal_code, city, country)
      VALUES (
        'dash-hold-expired',
        'Lars Janssen',
        'lars@example.com',
        2, 'nl',
        '2028-08-01', '2028-08-08',
        'on_hold',
        now() - interval '10 days',
        (now() - interval '3 days')::date,
        now() - interval '10 days',
        0, 'Teststraat 1', '1234 AB', 'Testdorp', 'NL'
      )
    `;

    await page.goto("/admin");
    await expect(page.getByText("Lars Janssen")).toBeVisible();
    await expect(page.getByText("Betaling verlopen")).toBeVisible();
  });

  test("shows approaching deadline in openstaande acties", async ({ page }) => {
    const sql = neon(process.env.DATABASE_URL!);
    await sql`
      INSERT INTO booking_request (id, name, email, guest_count, locale, start_date, end_date, status, confirmed_at, payment_deadline, created_at, shown_price_at_booking, address, postal_code, city, country)
      VALUES (
        'dash-hold-soon',
        'Ingrid Svensson',
        'ingrid@example.com',
        2, 'nl',
        '2028-09-01', '2028-09-08',
        'on_hold',
        now(),
        (now() + interval '2 days')::date,
        now(),
        0, 'Teststraat 1', '1234 AB', 'Testdorp', 'NL'
      )
    `;

    await page.goto("/admin");
    await expect(page.getByText("Ingrid Svensson")).toBeVisible();
    await expect(page.getByText("Betaling nadert")).toBeVisible();
  });

  test("shows upcoming confirmed stay in aankomende verblijven", async ({
    page,
  }) => {
    const sql = neon(process.env.DATABASE_URL!);
    await sql`
      INSERT INTO booking_request (id, name, email, guest_count, locale, start_date, end_date, status, created_at, shown_price_at_booking, address, postal_code, city, country)
      VALUES ('dash-conf-1', 'Kenji Watanabe', 'kenji@example.com', 2, 'en', '2028-10-01', '2028-10-08', 'confirmed', now(), 0, 'Teststraat 1', '1234 AB', 'Testdorp', 'NL')
    `;

    await page.goto("/admin");
    await expect(
      page.getByRole("heading", { name: "Aankomende verblijven" }),
    ).toBeVisible();
    await expect(page.getByText("Kenji Watanabe")).toBeVisible();
    await expect(page.getByText("Alles in orde")).toBeVisible();
  });

  test("shows an iCal interval as an upcoming external stay", async ({
    page,
  }) => {
    const sql = neon(process.env.DATABASE_URL!);
    const futureStart = "2028-12-01";
    const futureEnd = "2028-12-08";
    await sql`
      INSERT INTO ical_source (id, name, url, enabled, cached_intervals, created_at, updated_at)
      VALUES (
        'dash-ical-1',
        'Airbnb',
        'https://example.com/ical.ics',
        true,
        ${JSON.stringify([{ start: futureStart, end: futureEnd }])}::jsonb,
        now(), now()
      )
      ON CONFLICT (id) DO UPDATE
        SET cached_intervals = EXCLUDED.cached_intervals
    `;

    await page.goto("/admin");
    await expect(
      page.getByRole("heading", { name: "Aankomende verblijven" }),
    ).toBeVisible();
    const airbnbRow = page
      .locator("div")
      .filter({ hasText: /^Airbnb/ })
      .first();
    await expect(airbnbRow).toBeVisible();
    await expect(airbnbRow.getByText("extern")).toBeVisible();
  });

  test("clicking a new request action navigates to the bookings inbox", async ({
    page,
  }) => {
    const sql = neon(process.env.DATABASE_URL!);
    await sql`
      INSERT INTO booking_request (id, name, email, guest_count, locale, start_date, end_date, status, created_at, shown_price_at_booking, address, postal_code, city, country)
      VALUES ('dash-req-nav', 'Nav Test Guest', 'nav@example.com', 1, 'nl', '2028-11-01', '2028-11-07', 'requested', now(), 0, 'Teststraat 1', '1234 AB', 'Testdorp', 'NL')
    `;

    await page.goto("/admin");
    await page.getByText("Nav Test Guest").click();
    await expect(page).toHaveURL(/\/admin\/bookings/);
  });
});
