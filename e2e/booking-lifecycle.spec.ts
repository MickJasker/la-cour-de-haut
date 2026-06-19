import { test, expect } from "@playwright/test";
import { neon } from "@neondatabase/serverless";
import { authFile } from "./constants";

// All admin lifecycle tests run as the authenticated owner
test.use({ storageState: authFile });

async function seedBankDetails() {
  const sql = neon(process.env.DATABASE_URL!);
  await sql`
    INSERT INTO setting (key, value)
    VALUES ('iban', 'NL91ABNA0417164300'), ('bank_name', 'Test Bank'), ('account_holder', 'La Cour de Haut'), ('payment_deadline_days', '7')
    ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value
  `;
}

async function clearBookings() {
  const sql = neon(process.env.DATABASE_URL!);
  await sql`TRUNCATE booking_request`;
}

async function seedExpiredHold() {
  const sql = neon(process.env.DATABASE_URL!);
  await sql`
    INSERT INTO booking_request (id, name, email, guest_count, locale, start_date, end_date, status, confirmed_at, payment_deadline, created_at)
    VALUES (
      'expired-hold-1',
      'Jan Expired',
      'jan@example.com',
      2,
      'nl',
      '2027-08-01',
      '2027-08-08',
      'on_hold',
      now() - interval '10 days',
      (now() - interval '2 days')::date,
      now() - interval '10 days'
    )
  `;
}

test.describe("booking lifecycle — full admin funnel", () => {
  test.beforeEach(async () => {
    await clearBookings();
    await seedBankDetails();
  });

  test("guest submits form → request appears in inbox with status 'requested'", async ({
    page,
  }) => {
    // Submit as guest
    await page.goto("/nl/book");
    await expect(page.getByRole("grid")).toBeVisible();

    await page.getByLabel("Voor- en achternaam").fill("Marie Dupont");
    await page.getByLabel("E-mailadres").fill("marie@example.com");
    await page.getByLabel("Telefoonnummer").fill("+33612345678");

    const availableDates = page
      .getByRole("grid")
      .locator("button:not([disabled])");
    await availableDates.nth(0).click();
    await availableDates.nth(3).click();

    await page.getByRole("button", { name: "Boek nu" }).click();
    await expect(page.getByText("Bedankt voor uw boeking")).toBeVisible();

    // Check inbox
    await page.goto("/admin/bookings");
    await expect(page.getByText("Marie Dupont")).toBeVisible();
    await expect(page.getByText("Requested")).toBeVisible();
  });

  test("owner confirms a request → status becomes 'On hold'", async ({
    page,
  }) => {
    // Seed a booking request
    const sql = neon(process.env.DATABASE_URL!);
    await sql`
      INSERT INTO booking_request (id, name, email, guest_count, locale, start_date, end_date, status, created_at)
      VALUES ('test-req-1', 'Anna Schmidt', 'anna@example.com', 2, 'de', '2027-09-01', '2027-09-07', 'requested', now())
    `;

    await page.goto("/admin/bookings");
    await expect(page.getByText("Anna Schmidt")).toBeVisible();
    await expect(page.getByText("Requested")).toBeVisible();

    // Open confirm dialog
    await page.getByRole("button", { name: "Confirm" }).click();
    await expect(
      page.getByRole("dialog", { name: /confirm booking/i }),
    ).toBeVisible();

    // Submit with default deadline
    await page.getByRole("button", { name: "Confirm booking" }).click();
    await expect(page.getByRole("dialog")).not.toBeVisible();

    // Status updated
    await expect(page.getByText("On hold")).toBeVisible();
    await expect(page.getByText("Requested")).not.toBeVisible();
  });

  test("owner declines a request → status becomes 'Declined' and no action buttons remain", async ({
    page,
  }) => {
    const sql = neon(process.env.DATABASE_URL!);
    await sql`
      INSERT INTO booking_request (id, name, email, guest_count, locale, start_date, end_date, status, created_at)
      VALUES ('test-req-2', 'Peter Jones', 'peter@example.com', 3, 'en', '2027-10-01', '2027-10-05', 'requested', now())
    `;

    await page.goto("/admin/bookings");
    await expect(page.getByText("Peter Jones")).toBeVisible();

    await page.getByRole("button", { name: "Decline" }).click();

    await expect(page.getByText("Declined")).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Decline" }),
    ).not.toBeVisible();
  });

  test("owner marks a held booking as paid → status becomes 'Confirmed'", async ({
    page,
  }) => {
    const sql = neon(process.env.DATABASE_URL!);
    const deadline = new Date();
    deadline.setDate(deadline.getDate() + 7);
    const deadlineStr = deadline.toISOString().slice(0, 10);

    await sql`
      INSERT INTO booking_request (id, name, email, guest_count, locale, start_date, end_date, status, confirmed_at, payment_deadline, created_at)
      VALUES ('test-hold-1', 'Sophie Martin', 'sophie@example.com', 2, 'fr', '2027-11-01', '2027-11-08', 'on_hold', now(), ${deadlineStr}::date, now())
    `;

    await page.goto("/admin/bookings");
    await expect(page.getByText("Sophie Martin")).toBeVisible();
    await expect(page.getByText("On hold")).toBeVisible();

    await page.getByRole("button", { name: "Mark paid" }).click();

    await expect(page.getByText("Confirmed")).toBeVisible();
    await expect(page.getByText("On hold")).not.toBeVisible();
  });

  test("owner cancels a confirmed booking → status becomes 'Cancelled'", async ({
    page,
  }) => {
    const sql = neon(process.env.DATABASE_URL!);
    await sql`
      INSERT INTO booking_request (id, name, email, guest_count, locale, start_date, end_date, status, confirmed_at, payment_deadline, created_at)
      VALUES ('test-conf-1', 'Luca Rossi', 'luca@example.com', 4, 'en', '2027-12-01', '2027-12-10', 'confirmed', now(), now()::date, now())
    `;

    await page.goto("/admin/bookings");
    await expect(page.getByText("Luca Rossi")).toBeVisible();
    await expect(page.getByText("Confirmed")).toBeVisible();

    await page.getByRole("button", { name: "Cancel" }).click();

    await expect(page.getByText("Cancelled")).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Cancel" }),
    ).not.toBeVisible();
  });

  test("on_hold booking with past deadline is shown as 'Expired'", async ({
    page,
  }) => {
    await seedExpiredHold();

    await page.goto("/admin/bookings");
    await expect(page.getByText("Jan Expired")).toBeVisible();
    await expect(page.getByText("Expired")).toBeVisible();
    // Expired holds have no action buttons
    await expect(page.getByRole("button")).not.toBeVisible();
  });

  test("confirm button is disabled when bank details are not configured", async ({
    page,
  }) => {
    // Clear bank details
    const sql = neon(process.env.DATABASE_URL!);
    await sql`TRUNCATE setting`;
    await sql`
      INSERT INTO booking_request (id, name, email, guest_count, locale, start_date, end_date, status, created_at)
      VALUES ('test-nobk-1', 'No Bank Guest', 'guest@example.com', 1, 'nl', '2028-01-01', '2028-01-05', 'requested', now())
    `;

    await page.goto("/admin/bookings");
    await expect(page.getByText("No Bank Guest")).toBeVisible();

    const confirmBtn = page.getByRole("button", { name: "Confirm" });
    await expect(confirmBtn).toBeDisabled();
  });
});

test.describe("booking lifecycle — status filter", () => {
  test.use({ storageState: authFile });

  test.beforeAll(async () => {
    await clearBookings();
    const sql = neon(process.env.DATABASE_URL!);
    await sql`
      INSERT INTO booking_request (id, name, email, guest_count, locale, start_date, end_date, status, created_at)
      VALUES
        ('f-req', 'Filter Requested', 'a@a.com', 1, 'nl', '2028-02-01', '2028-02-05', 'requested', now()),
        ('f-dec', 'Filter Declined',  'b@b.com', 1, 'nl', '2028-02-01', '2028-02-05', 'declined',  now())
    `;
  });

  test("filtering by 'requested' shows only requested bookings", async ({
    page,
  }) => {
    await page.goto("/admin/bookings?status=requested");
    await expect(page.getByText("Filter Requested")).toBeVisible();
    await expect(page.getByText("Filter Declined")).not.toBeVisible();
  });

  test("no filter shows all bookings", async ({ page }) => {
    await page.goto("/admin/bookings");
    await expect(page.getByText("Filter Requested")).toBeVisible();
    await expect(page.getByText("Filter Declined")).toBeVisible();
  });
});
