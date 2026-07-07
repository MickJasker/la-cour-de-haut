import { test, expect } from "@playwright/test";
import { neon } from "@neondatabase/serverless";
import { authFile } from "./constants";

// All admin lifecycle tests run as the authenticated owner
test.use({ storageState: authFile });

async function seedBankDetails() {
  const sql = neon(process.env.DATABASE_URL!);
  await sql`
    INSERT INTO setting (key, value)
    VALUES ('iban', 'NL91ABNA0417164300'), ('bank_name', 'Test Bank'), ('account_holder', 'La Cour de Haut'), ('deposit_percentage', '50'), ('deposit_deadline_days', '3'), ('balance_due_days_before_arrival', '7'), ('security_deposit_amount', '200')
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
    INSERT INTO booking_request (id, name, email, guest_count, locale, start_date, end_date, status, confirmed_at, payment_deadline, created_at, shown_price_at_booking, address, postal_code, city, country)
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
      now() - interval '10 days',
      0, 'Teststraat 1', '1234 AB', 'Testdorp', 'NL'
    )
  `;
}

test.describe("booking lifecycle — full admin funnel", () => {
  test.beforeEach(async () => {
    await clearBookings();
    await seedBankDetails();
    // getSettings() is `use cache` — bust the tag after seeding so the page
    // always reads the freshly-written bank details rather than a stale cache
    // entry (e.g. the empty one written during global-setup's TRUNCATE, or left
    // by test 260's TRUNCATE + revalidate call).
    await fetch("http://localhost:3000/api/dev/revalidate/settings", {
      method: "POST",
    });
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
    await page.getByLabel("Straat en huisnummer").fill("Teststraat 1");
    await page.getByLabel("Postcode").fill("1234 AB");
    await page.getByLabel("Woonplaats").fill("Testdorp");

    const dutchDays = [
      "zondag",
      "maandag",
      "dinsdag",
      "woensdag",
      "donderdag",
      "vrijdag",
      "zaterdag",
    ];
    const dutchMonths = [
      "januari",
      "februari",
      "maart",
      "april",
      "mei",
      "juni",
      "juli",
      "augustus",
      "september",
      "oktober",
      "november",
      "december",
    ];
    const toAriaLabel = (d: Date) =>
      `${dutchDays[d.getDay()]} ${d.getDate()} ${dutchMonths[d.getMonth()]} ${d.getFullYear()}`;

    const checkin = new Date();
    checkin.setDate(checkin.getDate() + 1);
    const checkout = new Date();
    checkout.setDate(checkout.getDate() + 4);

    await page.locator(`button[aria-label="${toAriaLabel(checkin)}"]`).click();
    await page.locator(`button[aria-label="${toAriaLabel(checkout)}"]`).click();

    await page.waitForFunction(() => {
      const from = (
        document.querySelector(
          "input[name='stayDates.from']",
        ) as HTMLInputElement | null
      )?.value;
      const to = (
        document.querySelector(
          "input[name='stayDates.to']",
        ) as HTMLInputElement | null
      )?.value;
      return !!from && !!to && from !== to;
    });

    await page.getByRole("button", { name: "Boek nu" }).click();
    await expect(page.getByText("Bedankt voor uw boeking")).toBeVisible({
      timeout: 15000,
    });

    // Check inbox
    await page.goto("/admin/bookings");
    await expect(page.getByText("Marie Dupont")).toBeVisible();
    const dupontCard = page
      .locator("div.border")
      .filter({ hasText: "Marie Dupont" });
    await expect(
      dupontCard.locator("span").filter({ hasText: /^Aangevraagd$/ }),
    ).toBeVisible();
  });

  test("owner confirms a request → status becomes 'On hold'", async ({
    page,
  }) => {
    // Seed a booking request
    const sql = neon(process.env.DATABASE_URL!);
    await sql`
      INSERT INTO booking_request (id, name, email, guest_count, locale, start_date, end_date, status, created_at, shown_price_at_booking, address, postal_code, city, country)
      VALUES ('test-req-1', 'Anna Schmidt', 'anna@example.com', 2, 'de', '2027-09-01', '2027-09-07', 'requested', now(), 0, 'Teststraat 1', '1234 AB', 'Testdorp', 'NL')
    `;

    await page.goto("/admin/bookings");
    await expect(page.getByText("Anna Schmidt")).toBeVisible();
    const schmidtCard = page
      .locator("div.border")
      .filter({ hasText: "Anna Schmidt" });
    await expect(
      schmidtCard.locator("span").filter({ hasText: /^Aangevraagd$/ }),
    ).toBeVisible();

    // Open confirm dialog — scope to the card so stray bookings from parallel tests don't cause strict mode violations
    await schmidtCard.getByRole("button", { name: "Bevestigen" }).click();
    await expect(
      page.getByRole("dialog", { name: /boeking bevestigen/i }),
    ).toBeVisible();

    // Submit with default deadline
    await page.getByRole("button", { name: "Boeking bevestigen" }).click();
    await expect(page.getByRole("dialog")).not.toBeVisible();

    // Status updated — scope to card so the filter nav chip doesn't interfere
    await expect(
      schmidtCard.locator("span").filter({ hasText: /^In afwachting$/ }),
    ).toBeVisible();
    await expect(
      schmidtCard.locator("span").filter({ hasText: /^Aangevraagd$/ }),
    ).not.toBeVisible();
  });

  test("owner declines a request → status becomes 'Declined' and no action buttons remain", async ({
    page,
  }) => {
    const sql = neon(process.env.DATABASE_URL!);
    await sql`
      INSERT INTO booking_request (id, name, email, guest_count, locale, start_date, end_date, status, created_at, shown_price_at_booking, address, postal_code, city, country)
      VALUES ('test-req-2', 'Peter Jones', 'peter@example.com', 3, 'en', '2027-10-01', '2027-10-05', 'requested', now(), 0, 'Teststraat 1', '1234 AB', 'Testdorp', 'NL')
    `;

    await page.goto("/admin/bookings");
    await expect(page.getByText("Peter Jones")).toBeVisible();

    await page.getByRole("button", { name: "Afwijzen" }).click();

    // Sends the decline notice (issue #165), a no-op under E2E_TESTING
    // (playwright.config.ts) — the transition succeeding here proves the
    // send-then-transition path doesn't roll back under the stubbed
    // transport.
    await expect(
      page.locator("span").filter({ hasText: /^Afgewezen$/ }),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Afwijzen" }),
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
      INSERT INTO booking_request (id, name, email, guest_count, locale, start_date, end_date, status, confirmed_at, payment_deadline, created_at, shown_price_at_booking, address, postal_code, city, country)
      VALUES ('test-hold-1', 'Sophie Martin', 'sophie@example.com', 2, 'fr', '2027-11-01', '2027-11-08', 'on_hold', now(), ${deadlineStr}::date, now(), 0, 'Teststraat 1', '1234 AB', 'Testdorp', 'NL')
    `;

    await page.goto("/admin/bookings");
    await expect(page.getByText("Sophie Martin")).toBeVisible();
    const martinCard = page
      .locator("div.border")
      .filter({ hasText: "Sophie Martin" });
    await expect(
      martinCard.locator("span").filter({ hasText: /^In afwachting$/ }),
    ).toBeVisible();

    await page.getByRole("button", { name: "Betaald markeren" }).click();

    await expect(
      martinCard.locator("span").filter({ hasText: /^Bevestigd$/ }),
    ).toBeVisible();
    await expect(
      martinCard.locator("span").filter({ hasText: /^In afwachting$/ }),
    ).not.toBeVisible();
  });

  test("owner cancels a confirmed booking → status becomes 'Cancelled'", async ({
    page,
  }) => {
    const sql = neon(process.env.DATABASE_URL!);
    await sql`
      INSERT INTO booking_request (id, name, email, guest_count, locale, start_date, end_date, status, confirmed_at, payment_deadline, created_at, shown_price_at_booking, address, postal_code, city, country)
      VALUES ('test-conf-1', 'Luca Rossi', 'luca@example.com', 4, 'en', '2027-12-01', '2027-12-10', 'confirmed', now(), now()::date, now(), 0, 'Teststraat 1', '1234 AB', 'Testdorp', 'NL')
    `;

    await page.goto("/admin/bookings");
    await expect(page.getByText("Luca Rossi")).toBeVisible();
    const rossiCard = page
      .locator("div.border")
      .filter({ hasText: "Luca Rossi" });
    await expect(
      rossiCard.locator("span").filter({ hasText: /^Bevestigd$/ }),
    ).toBeVisible();

    await page.getByRole("button", { name: "Annuleren" }).click();

    // Sends the cancellation notice (issue #165), a no-op under E2E_TESTING
    // (playwright.config.ts) — the transition succeeding here proves the
    // send-then-transition path doesn't roll back under the stubbed
    // transport. States the cancellation only — no refund/amount talk.
    await expect(
      rossiCard.locator("span").filter({ hasText: /^Geannuleerd$/ }),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Annuleren" }),
    ).not.toBeVisible();
  });

  test("owner cancels an on_hold booking → status becomes 'Cancelled' and sends the cancellation email", async ({
    page,
  }) => {
    const sql = neon(process.env.DATABASE_URL!);
    const deadline = new Date();
    deadline.setDate(deadline.getDate() + 7);
    const deadlineStr = deadline.toISOString().slice(0, 10);

    await sql`
      INSERT INTO booking_request (id, name, email, guest_count, locale, start_date, end_date, status, confirmed_at, payment_deadline, created_at, shown_price_at_booking, address, postal_code, city, country)
      VALUES ('test-hold-cancel-1', 'Mette Olsen', 'mette@example.com', 2, 'de', '2027-11-15', '2027-11-22', 'on_hold', now(), ${deadlineStr}::date, now(), 0, 'Teststraat 1', '1234 AB', 'Testdorp', 'NL')
    `;

    await page.goto("/admin/bookings");
    const olsenCard = page
      .locator("div.border")
      .filter({ hasText: "Mette Olsen" });
    await expect(
      olsenCard.locator("span").filter({ hasText: /^In afwachting$/ }),
    ).toBeVisible();

    await olsenCard.getByRole("button", { name: "Annuleren" }).click();

    // Cancel is valid from on_hold too (not just confirmed) — sends the same
    // cancellation notice, again a stubbed no-op under E2E_TESTING.
    await expect(
      olsenCard.locator("span").filter({ hasText: /^Geannuleerd$/ }),
    ).toBeVisible();
  });

  test("on_hold booking with past deadline is shown as 'Expired'", async ({
    page,
  }) => {
    await seedExpiredHold();

    await page.goto("/admin/bookings");
    await expect(page.getByText("Jan Expired")).toBeVisible();
    await expect(
      page.locator("span").filter({ hasText: /^Verlopen$/ }),
    ).toBeVisible();
    // Expired holds have no action buttons — scoped to the card to avoid matching sidebar buttons
    const expiredCard = page
      .locator("div.border")
      .filter({ hasText: "Jan Expired" });
    await expect(expiredCard.getByRole("button")).not.toBeVisible();
  });

  test("confirm button is disabled when bank details are not configured", async ({
    page,
  }) => {
    // Clear bank details
    const sql = neon(process.env.DATABASE_URL!);
    await sql`TRUNCATE setting`;
    await sql`
      INSERT INTO booking_request (id, name, email, guest_count, locale, start_date, end_date, status, created_at, shown_price_at_booking, address, postal_code, city, country)
      VALUES ('test-nobk-1', 'No Bank Guest', 'guest@example.com', 1, 'nl', '2028-01-01', '2028-01-05', 'requested', now(), 0, 'Teststraat 1', '1234 AB', 'Testdorp', 'NL')
    `;
    // getSettings() is `use cache` — bust the tag so the page sees the truncated table
    await fetch("http://localhost:3000/api/dev/revalidate/settings", {
      method: "POST",
    });

    await page.goto("/admin/bookings");
    await expect(page.getByText("No Bank Guest")).toBeVisible();

    const confirmBtn = page.getByRole("button", { name: "Bevestigen" });
    await expect(confirmBtn).toBeDisabled();
  });

  test("two-stage happy path: confirm → deposit paid → balance paid → confirmed", async ({
    page,
  }) => {
    // Arrival far in the future → the schedule does not collapse, so the
    // booking passes through the deposit_paid stage.
    const sql = neon(process.env.DATABASE_URL!);
    await sql`
      INSERT INTO booking_request (id, name, email, guest_count, locale, start_date, end_date, status, created_at, shown_price_at_booking, address, postal_code, city, country)
      VALUES ('two-stage-1', 'Deux Etapes', 'deux@example.com', 2, 'nl', '2028-06-01', '2028-06-08', 'requested', now(), 200, 'Teststraat 1', '1234 AB', 'Testdorp', 'NL')
    `;

    await page.goto("/admin/bookings");
    const card = page.locator("div.border").filter({ hasText: "Deux Etapes" });
    await expect(card).toBeVisible();

    // Confirm — the dialog previews a two-stage schedule.
    await card.getByRole("button", { name: "Bevestigen" }).click();
    const dialog = page.getByRole("dialog", { name: /boeking bevestigen/i });
    await expect(dialog).toBeVisible();
    await expect(dialog.getByText("Aanbetaling")).toBeVisible();
    await expect(dialog.getByText("Restbetaling")).toBeVisible();
    await page.getByRole("button", { name: "Boeking bevestigen" }).click();
    await expect(page.getByRole("dialog")).not.toBeVisible();

    // on_hold with a two-stage snapshot → mark the deposit paid. This also
    // sends the deposit-received receipt (issue #164), a no-op under
    // E2E_TESTING (playwright.config.ts) — the transition succeeding here
    // proves the send-then-transition path doesn't roll back under the
    // stubbed transport.
    await expect(
      card.locator("span").filter({ hasText: /^In afwachting$/ }),
    ).toBeVisible();
    await card.getByRole("button", { name: "Aanbetaling markeren" }).click();

    // deposit_paid → mark the balance paid. Sends the balance-received
    // receipt (issue #164), likewise stubbed.
    await expect(
      card.locator("span").filter({ hasText: /^Aanbetaling voldaan$/ }),
    ).toBeVisible();
    await card.getByRole("button", { name: "Restbetaling markeren" }).click();

    // confirmed.
    await expect(
      card.locator("span").filter({ hasText: /^Bevestigd$/ }),
    ).toBeVisible();
  });

  test("collapse path: short-notice confirm → single payment → confirmed", async ({
    page,
  }) => {
    // Arrival ~8 days out → balance deadline (arrival − 7) falls on/before the
    // deposit deadline (today + 3), so the schedule collapses to one payment.
    const sql = neon(process.env.DATABASE_URL!);
    const arrival = new Date();
    arrival.setDate(arrival.getDate() + 8);
    const departure = new Date();
    departure.setDate(departure.getDate() + 12);
    const iso = (d: Date) => d.toISOString().slice(0, 10);

    await sql`
      INSERT INTO booking_request (id, name, email, guest_count, locale, start_date, end_date, status, created_at, shown_price_at_booking, address, postal_code, city, country)
      VALUES ('collapse-1', 'Court Delai', 'court@example.com', 2, 'nl', ${iso(arrival)}::date, ${iso(departure)}::date, 'requested', now(), 200, 'Teststraat 1', '1234 AB', 'Testdorp', 'NL')
    `;

    await page.goto("/admin/bookings");
    const card = page.locator("div.border").filter({ hasText: "Court Delai" });
    await expect(card).toBeVisible();

    // Confirm — the dialog previews a single collapsed payment.
    await card.getByRole("button", { name: "Bevestigen" }).click();
    const dialog = page.getByRole("dialog", { name: /boeking bevestigen/i });
    await expect(dialog).toBeVisible();
    await expect(dialog.getByText(/Eén betaling/)).toBeVisible();
    await page.getByRole("button", { name: "Boeking bevestigen" }).click();
    await expect(page.getByRole("dialog")).not.toBeVisible();

    // on_hold with a collapsed snapshot → a single mark-paid goes straight to
    // confirmed (no deposit_paid stage, no "Aanbetaling markeren" button).
    await expect(
      card.locator("span").filter({ hasText: /^In afwachting$/ }),
    ).toBeVisible();
    await expect(
      card.getByRole("button", { name: "Aanbetaling markeren" }),
    ).not.toBeVisible();
    // Sends the balance-received receipt (issue #164) — the collapse path's
    // single mark-paid gets the same receipt as the two-stage balance leg.
    await card.getByRole("button", { name: "Betaald markeren" }).click();

    await expect(
      card.locator("span").filter({ hasText: /^Bevestigd$/ }),
    ).toBeVisible();
  });
});

test.describe("booking lifecycle — status filter", () => {
  test.use({ storageState: authFile });

  test.beforeAll(async () => {
    await clearBookings();
    const sql = neon(process.env.DATABASE_URL!);
    await sql`
      INSERT INTO booking_request (id, name, email, guest_count, locale, start_date, end_date, status, created_at, shown_price_at_booking, address, postal_code, city, country)
      VALUES
        ('f-req', 'Filter Requested', 'a@a.com', 1, 'nl', '2028-02-01', '2028-02-05', 'requested', now(), 0, 'Teststraat 1', '1234 AB', 'Testdorp', 'NL'),
        ('f-dec', 'Filter Declined',  'b@b.com', 1, 'nl', '2028-02-01', '2028-02-05', 'declined',  now(), 0, 'Teststraat 1', '1234 AB', 'Testdorp', 'NL')
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

  test.afterAll(async () => {
    await clearBookings();
  });
});
