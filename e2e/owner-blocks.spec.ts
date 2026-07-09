import { test, expect } from "@playwright/test";
import { neon } from "@neondatabase/serverless";
import { authFile } from "./constants";

test.use({ storageState: authFile });

async function clearBookings() {
  const sql = neon(process.env.DATABASE_URL!);
  await sql`TRUNCATE booking_request`;
}

async function clearBlocks() {
  const sql = neon(process.env.DATABASE_URL!);
  // Never TRUNCATE owner_block — ical-export.spec.ts seeds its own
  // 'ical-test-%' rows in parallel workers. Only remove rows this spec's
  // tests can create: everything is UI-labeled "E2E%", plus the fixed ids
  // seeded directly via SQL below.
  await sql`
    DELETE FROM owner_block
    WHERE label LIKE 'E2E%'
       OR id IN ('e2e-block-edit-1', 'e2e-block-del-1')
       OR start_date = ${unlabeledStart}
  `;
}

// Days 10–26 exist in every month, so the seeded/selected spans always fall
// inside the calendar's initial (current) month.
const currentMonth = new Date().toISOString().slice(0, 7);
const day10 = `${currentMonth}-10`;
const day12 = `${currentMonth}-12`;
const day13 = `${currentMonth}-13`;
const day14 = `${currentMonth}-14`;
const day15 = `${currentMonth}-15`;
const day16 = `${currentMonth}-16`;
const day18 = `${currentMonth}-18`;
const day20 = `${currentMonth}-20`;
const day21 = `${currentMonth}-21`;
const day25 = `${currentMonth}-25`;
const day26 = `${currentMonth}-26`;

// The unlabeled-block test can't tag its row with "E2E%" (no label at all),
// so it's cleaned up by its fixed start_date instead.
const unlabeledStart = day20;

/**
 * Post-action assertions (create/save/delete → calendar reflects it) wait on
 * a server-action round-trip plus the RSC refresh, which under CI's parallel
 * workers can exceed the 5s default — the same slow-refresh class the
 * booking-lifecycle admin tests hit. The action itself is confirmed fast via
 * the popover closing; only the refreshed calendar gets the long timeout.
 */
const REFRESH_TIMEOUT = 15_000;

/** The popover form is gone once the action round-trip succeeded — if the
 * action failed, it stays open showing the error, failing this fast. */
async function expectPopoverClosed(page: import("@playwright/test").Page) {
  await expect(
    page.getByRole("textbox", { name: "Label (optioneel)" }),
  ).toBeHidden({ timeout: REFRESH_TIMEOUT });
}

test.describe("owner blocks", () => {
  // clearBookings truncates booking_request, which would race the other
  // booking-seeding specs' all-clear assumptions if interleaved.
  test.describe.configure({ mode: "serial" });

  test.beforeEach(async () => {
    await clearBookings();
    await clearBlocks();
  });

  test.afterAll(async () => {
    await clearBlocks();
  });

  test("two clicks + label creates a block shown as a labeled bar", async ({
    page,
  }) => {
    await page.goto("/admin");
    const calendar = page.getByTestId("occupancy-calendar");
    await expect(calendar).toBeVisible();

    await calendar.locator(`[data-date="${day10}"]`).click();
    await calendar.locator(`[data-date="${day13}"]`).click();

    await page
      .getByRole("textbox", { name: "Label (optioneel)" })
      .fill("E2E eigen verblijf");
    await page.getByRole("button", { name: "Blokkeren" }).click();
    await expectPopoverClosed(page);

    await expect(
      calendar.getByRole("button", { name: "E2E eigen verblijf" }).first(),
    ).toBeVisible({ timeout: REFRESH_TIMEOUT });

    // Inclusive selection (day10..day13) stores as exclusive end = day14
    // (last blocked day + 1, ADR-0022 decision 4).
    const sql = neon(process.env.DATABASE_URL!);
    const rows = await sql`
      SELECT start_date::text AS start_date, end_date::text AS end_date
      FROM owner_block WHERE label = 'E2E eigen verblijf'
    `;
    expect(rows).toHaveLength(1);
    expect(rows[0].start_date).toBe(day10);
    expect(rows[0].end_date).toBe(day14);
  });

  test("a block created without a label shows Geblokkeerd", async ({
    page,
  }) => {
    await page.goto("/admin");
    const calendar = page.getByTestId("occupancy-calendar");
    await expect(calendar).toBeVisible();

    await calendar.locator(`[data-date="${day20}"]`).click();
    await calendar.locator(`[data-date="${day21}"]`).click();

    await page.getByRole("button", { name: "Blokkeren" }).click();
    await expectPopoverClosed(page);

    await expect(
      calendar.getByRole("button", { name: "Geblokkeerd" }).first(),
    ).toBeVisible({ timeout: REFRESH_TIMEOUT });
  });

  test("selecting a range overlapping a pending request warns but still allows blocking", async ({
    page,
  }) => {
    const sql = neon(process.env.DATABASE_URL!);
    await sql`
      INSERT INTO booking_request (id, name, email, guest_count, locale, start_date, end_date, status, created_at, shown_price_at_booking, address, postal_code, city, country)
      VALUES ('e2e-block-req-1', 'Overlap Gast', 'overlap@example.com', 2, 'nl', ${day10}, ${day15}, 'requested', now(), 0, 'Teststraat 1', '1234 AB', 'Testdorp', 'NL')
    `;

    await page.goto("/admin");
    const calendar = page.getByTestId("occupancy-calendar");
    await expect(calendar).toBeVisible();

    await calendar.locator(`[data-date="${day12}"]`).click();
    await calendar.locator(`[data-date="${day13}"]`).click();

    await expect(page.getByText(/openstaande aanvra/)).toBeVisible();
    // The dashboard's "Nieuwe aanvragen" list also links this guest's name
    // (as "Overlap Gast Nieuw verzoek") — match the popover's link exactly.
    await expect(
      page.getByRole("link", { name: "Overlap Gast", exact: true }),
    ).toBeVisible();

    await page
      .getByRole("textbox", { name: "Label (optioneel)" })
      .fill("E2E overlap");
    await page.getByRole("button", { name: "Blokkeren" }).click();
    await expectPopoverClosed(page);

    await expect(
      calendar.getByRole("button", { name: "E2E overlap" }).first(),
    ).toBeVisible({ timeout: REFRESH_TIMEOUT });
  });

  test("editing a block's label via its popover", async ({ page }) => {
    const sql = neon(process.env.DATABASE_URL!);
    await sql`
      INSERT INTO owner_block (id, start_date, end_date, label, created_at)
      VALUES ('e2e-block-edit-1', ${day16}, ${day18}, 'E2E oud label', now())
    `;

    await page.goto("/admin");
    const calendar = page.getByTestId("occupancy-calendar");
    await calendar
      .getByRole("button", { name: "E2E oud label" })
      .first()
      .click();

    // Radix popovers render in a portal — query on `page`, not the calendar.
    const input = page.getByRole("textbox", { name: "Label (optioneel)" });
    await input.fill("E2E nieuw label");
    await page.getByRole("button", { name: "Opslaan" }).click();
    await expectPopoverClosed(page);

    await expect(
      calendar.getByRole("button", { name: "E2E nieuw label" }).first(),
    ).toBeVisible({ timeout: REFRESH_TIMEOUT });
    await expect(
      calendar.getByRole("button", { name: "E2E oud label" }),
    ).toHaveCount(0);
  });

  test("Deblokkeren deletes the block", async ({ page }) => {
    const sql = neon(process.env.DATABASE_URL!);
    await sql`
      INSERT INTO owner_block (id, start_date, end_date, label, created_at)
      VALUES ('e2e-block-del-1', ${day25}, ${day26}, 'E2E weg', now())
    `;

    await page.goto("/admin");
    const calendar = page.getByTestId("occupancy-calendar");
    await calendar.getByRole("button", { name: "E2E weg" }).first().click();

    await page.getByRole("button", { name: "Deblokkeren" }).click();
    await expectPopoverClosed(page);

    await expect(calendar.getByRole("button", { name: "E2E weg" })).toHaveCount(
      0,
      { timeout: REFRESH_TIMEOUT },
    );

    const rows = await sql`
      SELECT id FROM owner_block WHERE id = 'e2e-block-del-1'
    `;
    expect(rows).toHaveLength(0);
  });
});
