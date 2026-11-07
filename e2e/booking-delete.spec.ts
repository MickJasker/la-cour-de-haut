import { test, expect } from "@playwright/test";
import { neon } from "@neondatabase/serverless";
import { authFile } from "./constants";

test.use({ storageState: authFile });
// Seeds terminal + active bookings; keep ordering deterministic on the worker.
test.describe.configure({ mode: "serial" });

const IDS = ["del-declined", "del-active"];

async function seed() {
  const sql = neon(process.env.DATABASE_URL!);
  await sql`DELETE FROM booking_request WHERE id = ANY(${IDS})`;
  await sql`
    INSERT INTO booking_request (id, name, email, guest_count, locale, start_date, end_date, status, created_at, shown_price_at_booking, address, postal_code, city, country)
    VALUES
      ('del-declined', 'Dead Declined', 'a@a.com', 1, 'nl', '2028-03-01', '2028-03-05', 'declined', now(), 0, 'Teststraat 1', '1234 AB', 'Testdorp', 'NL'),
      ('del-active', 'Live Requested', 'b@b.com', 1, 'nl', '2028-04-01', '2028-04-05', 'requested', now(), 0, 'Teststraat 1', '1234 AB', 'Testdorp', 'NL')
  `;
}

test.describe("admin — delete dead bookings", () => {
  test.beforeAll(seed);
  test.afterAll(async () => {
    const sql = neon(process.env.DATABASE_URL!);
    await sql`DELETE FROM booking_request WHERE id = ANY(${IDS})`;
  });

  test("an active booking's card offers no delete", async ({ page }) => {
    await page.goto("/admin/bookings");
    const card = page
      .locator("div.border")
      .filter({ hasText: "Live Requested" });
    await expect(card.getByRole("button", { name: "Afwijzen" })).toBeVisible();
    await expect(card.getByRole("button", { name: "Verwijderen" })).toHaveCount(
      0,
    );
  });

  test("owner deletes a declined booking via the confirm dialog", async ({
    page,
  }) => {
    await page.goto("/admin/bookings");
    await page.getByRole("button", { name: "Verwijderen" }).first().click();

    const dialog = page.getByRole("dialog", { name: /boeking verwijderen/i });
    await expect(dialog).toBeVisible();
    await expect(
      dialog.getByText(/kan niet ongedaan worden gemaakt/),
    ).toBeVisible();
    await dialog
      .getByRole("button", { name: "Definitief verwijderen" })
      .click();

    await expect(page.getByRole("dialog")).not.toBeVisible();
    await expect(page.getByText("Dead Declined")).toHaveCount(0);
    await expect(page.getByText("Live Requested")).toBeVisible();

    const sql = neon(process.env.DATABASE_URL!);
    const rows =
      await sql`SELECT 1 FROM booking_request WHERE id = 'del-declined'`;
    expect(rows).toHaveLength(0);
  });
});
