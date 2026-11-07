import { test, expect, type Page } from "@playwright/test";
import { neon } from "@neondatabase/serverless";
import { authFile } from "./constants";

test.use({ storageState: authFile });
// Seeds terminal + active bookings; keep ordering deterministic on the worker.
test.describe.configure({ mode: "serial" });

const IDS = [
  "del-declined",
  "del-active",
  "del-cancelled",
  "del-expired",
  "del-confirmed",
];

async function seed() {
  const sql = neon(process.env.DATABASE_URL!);
  await sql`DELETE FROM booking_request WHERE id = ANY(${IDS})`;
  await sql`
    INSERT INTO booking_request (id, name, email, guest_count, locale, start_date, end_date, status, created_at, shown_price_at_booking, address, postal_code, city, country)
    VALUES
      ('del-declined', 'Dead Declined', 'a@a.com', 1, 'nl', '2028-03-01', '2028-03-05', 'declined', now(), 0, 'Teststraat 1', '1234 AB', 'Testdorp', 'NL'),
      ('del-cancelled', 'Dead Cancelled', 'c@c.com', 1, 'nl', '2028-05-01', '2028-05-05', 'cancelled', now(), 0, 'Teststraat 1', '1234 AB', 'Testdorp', 'NL'),
      ('del-confirmed', 'Kept Confirmed', 'd@d.com', 1, 'nl', '2028-06-01', '2028-06-05', 'confirmed', now(), 0, 'Teststraat 1', '1234 AB', 'Testdorp', 'NL'),
      ('del-active', 'Live Requested', 'b@b.com', 1, 'nl', '2028-04-01', '2028-04-05', 'requested', now(), 0, 'Teststraat 1', '1234 AB', 'Testdorp', 'NL')
  `;
}

async function seedExpiredHold() {
  const sql = neon(process.env.DATABASE_URL!);
  await sql`
    INSERT INTO booking_request (id, name, email, guest_count, locale, start_date, end_date, status, payment_deadline, created_at, shown_price_at_booking, address, postal_code, city, country)
    VALUES ('del-expired', 'Dead Expired', 'e@e.com', 1, 'nl', '2028-07-01', '2028-07-05', 'on_hold', (now() - interval '2 days')::date, now(), 0, 'Teststraat 1', '1234 AB', 'Testdorp', 'NL')
  `;
}

test.describe("admin — delete dead bookings", () => {
  test.beforeAll(async () => {
    await seed();
    await seedExpiredHold();
  });
  test.afterAll(async () => {
    const sql = neon(process.env.DATABASE_URL!);
    await sql`DELETE FROM booking_request WHERE id = ANY(${IDS})`;
  });

  const card = (page: Page, name: string) =>
    page.locator("div.border").filter({ hasText: name });

  for (const name of ["Live Requested", "Kept Confirmed"]) {
    test(`${name}: card offers no delete`, async ({ page }) => {
      await page.goto("/admin/bookings");
      await expect(card(page, name)).toBeVisible();
      await expect(
        card(page, name).getByRole("button", { name: "Verwijderen" }),
      ).toHaveCount(0);
    });
  }

  for (const [name, id] of [
    ["Dead Declined", "del-declined"],
    ["Dead Cancelled", "del-cancelled"],
    ["Dead Expired", "del-expired"],
  ]) {
    test(`owner deletes ${name} via the confirm dialog`, async ({ page }) => {
      await page.goto("/admin/bookings");
      await card(page, name)
        .getByRole("button", { name: "Verwijderen" })
        .click();

      const dialog = page.getByRole("dialog", { name: /boeking verwijderen/i });
      await expect(dialog).toBeVisible();
      await expect(
        dialog.getByText(/kan niet ongedaan worden gemaakt/),
      ).toBeVisible();
      await dialog
        .getByRole("button", { name: "Definitief verwijderen" })
        .click();

      await expect(page.getByRole("dialog")).not.toBeVisible();
      await expect(page.getByText(name)).toHaveCount(0);
      await expect(page.getByText("Live Requested")).toBeVisible();

      const sql = neon(process.env.DATABASE_URL!);
      const rows = await sql`SELECT 1 FROM booking_request WHERE id = ${id}`;
      expect(rows).toHaveLength(0);
    });
  }
});
