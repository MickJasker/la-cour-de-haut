import { test, expect } from "@playwright/test";
import { neon } from "@neondatabase/serverless";

async function deleteTestSubmissions() {
  const sql = neon(process.env.DATABASE_URL!);
  await sql`DELETE FROM booking_request WHERE email = 'test@example.com'`;
}

test.describe("booking form — standalone page (/nl/book)", () => {
  // "valid submission" test creates a real booking_request row — clean it up so
  // parallel workers don't see a stray requested booking on /admin/bookings.
  test.afterEach(deleteTestSubmissions);

  test.beforeEach(async ({ page }) => {
    await page.goto("/nl/book");
    // Wait for the form to finish streaming (booked-dates promise resolves)
    await expect(page.getByRole("grid")).toBeVisible();
  });

  test("all form fields are present", async ({ page }) => {
    await expect(page.getByLabel("Voor- en achternaam")).toBeVisible();
    await expect(page.getByLabel("E-mailadres")).toBeVisible();
    await expect(page.getByLabel("Telefoonnummer")).toBeVisible();
    await expect(page.getByLabel("Straat en huisnummer")).toBeVisible();
    await expect(page.getByLabel("Postcode")).toBeVisible();
    await expect(page.getByLabel("Woonplaats")).toBeVisible();
    // Two comboboxes now: the address country (labelled "Land") and the phone
    // calling-code picker (aria-label "Landnummer"). role="combobox" is not a
    // name-from-content role, so each is named by its label/aria-label, not its
    // value; "Land" is a substring of "Landnummer" so match exactly.
    await expect(page.getByRole("combobox")).toHaveCount(2);
    await expect(
      page.getByRole("combobox", { name: "Land", exact: true }),
    ).toBeVisible();
    await expect(
      page.getByRole("combobox", { name: "Landnummer", exact: true }),
    ).toBeVisible();
    await expect(page.getByRole("radio", { name: "1 gast" })).toBeVisible();
    await expect(page.getByRole("radio", { name: "2 gasten" })).toBeVisible();
    await expect(page.getByRole("grid")).toBeVisible();
    await expect(page.getByRole("button", { name: "Boek nu" })).toBeVisible();
  });

  test("submitting empty form shows required-field errors", async ({
    page,
  }) => {
    await page.getByRole("button", { name: "Boek nu" }).click();

    // Multiple required fields now share this message, so scope to the first.
    await expect(page.getByText("Dit veld is verplicht").first()).toBeVisible();
    await expect(
      page.getByText("Voer een geldig e-mailadres in"),
    ).toBeVisible();
  });

  test("invalid email shows email validation error", async ({ page }) => {
    await page.getByLabel("Voor- en achternaam").fill("Test Gebruiker");
    await page.getByLabel("Straat en huisnummer").fill("Teststraat 1");
    await page.getByLabel("Postcode").fill("1234 AB");
    await page.getByLabel("Woonplaats").fill("Testdorp");
    // Phone is now required (ADR-0013); fill a valid national number (the picker
    // defaults to NL on /nl → +31) so only the email is invalid below.
    await page.getByLabel("Telefoonnummer").fill("0612345678");
    await page.getByLabel("E-mailadres").fill("notanemail");
    await page.getByRole("button", { name: "Boek nu" }).click();

    await expect(
      page.getByText("Voer een geldig e-mailadres in"),
    ).toBeVisible();
    // All required text fields are filled (country preselects to NL), so the
    // "required" message should not appear anywhere — only the email is invalid.
    await expect(page.getByText("Dit veld is verplicht")).not.toBeVisible();
    // Re-hydration invariant: the typed national number (with its trunk 0) must
    // survive the server validation bounce — not get blanked or reformatted.
    await expect(page.getByLabel("Telefoonnummer")).toHaveValue("0612345678");
  });

  test("valid submission shows success message", async ({ page }) => {
    await page.getByLabel("Voor- en achternaam").fill("Test Gebruiker");
    await page.getByLabel("E-mailadres").fill("test@example.com");
    // National number; the picker defaults to NL on /nl, composing +31612345678.
    await page.getByLabel("Telefoonnummer").fill("0612345678");
    await page.getByLabel("Straat en huisnummer").fill("Teststraat 1");
    await page.getByLabel("Postcode").fill("1234 AB");
    await page.getByLabel("Woonplaats").fill("Testdorp");

    // Use aria-label selectors for unambiguous date targeting — nth() is fragile
    // after re-renders because react-day-picker may shift indices.
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

    // Wait until to !== from — react-day-picker sets from=to on first click.
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

    await expect(
      page.getByText(
        "Bedankt voor uw boeking! We nemen binnenkort contact met u op.",
      ),
    ).toBeVisible({ timeout: 15000 });
  });
});

test.describe("booking form — long-stay discount", () => {
  test.beforeAll(async () => {
    const sql = neon(process.env.DATABASE_URL!);
    await sql`
      INSERT INTO setting (key, value) VALUES ('price_per_night', '150')
      ON CONFLICT (key) DO UPDATE SET value = '150'
    `;
    await fetch("http://localhost:3000/api/dev/revalidate/settings", {
      method: "POST",
    });
  });

  test.afterEach(async () => {
    const sql = neon(process.env.DATABASE_URL!);
    await sql`DELETE FROM booking_request WHERE email = 'test@example.com'`;
  });

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

  async function selectDates(
    page: import("@playwright/test").Page,
    nights: number,
  ) {
    const checkin = new Date();
    checkin.setDate(checkin.getDate() + 2);
    const checkout = new Date(checkin);
    checkout.setDate(checkout.getDate() + nights);
    await page.locator(`button[aria-label="${toAriaLabel(checkin)}"]`).click();
    // Navigate to the next month if checkout falls outside the currently visible month
    if (
      checkout.getMonth() !== checkin.getMonth() ||
      checkout.getFullYear() !== checkin.getFullYear()
    ) {
      await page.locator(".rdp-button_next").click();
    }
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
  }

  test("no discount line shown for stays under 7 nights", async ({ page }) => {
    await page.goto("/nl/book");
    await expect(page.getByRole("grid")).toBeVisible();
    await selectDates(page, 6);
    await expect(
      page.getByText("10% korting", { exact: false }),
    ).not.toBeVisible();
  });

  test("discount line and breakdown shown for 7+ night stays", async ({
    page,
  }) => {
    await page.goto("/nl/book");
    await expect(page.getByRole("grid")).toBeVisible();
    await selectDates(page, 7);
    await expect(page.getByText("10% korting", { exact: false })).toBeVisible();
    await expect(page.getByText("Totaal:", { exact: false })).toBeVisible();
  });
});

test.describe("booking form — modal", () => {
  test("form fields are present inside the booking dialog", async ({
    page,
  }) => {
    await page.goto("/nl");
    // Header CTA located by its /book href, not its label (see book.spec.ts).
    await page.getByRole("banner").locator("a[href$='/book']").click();
    await expect(page.getByRole("dialog")).toBeVisible();

    const dialog = page.getByRole("dialog");
    // Wait for the Suspense boundary to resolve before asserting form content
    await expect(dialog.getByRole("grid")).toBeVisible();
    await expect(dialog.getByLabel("Voor- en achternaam")).toBeVisible();
    await expect(dialog.getByLabel("E-mailadres")).toBeVisible();
    await expect(dialog.getByRole("button", { name: "Boek nu" })).toBeVisible();
  });
});

test.describe("booking form — payment-schedule breakdown", () => {
  // Mutates global settings (borg + nightly price) that other specs read;
  // run this block's tests serially so the two presentations never race each
  // other's seed state.
  test.describe.configure({ mode: "serial" });

  test.beforeAll(async () => {
    const sql = neon(process.env.DATABASE_URL!);
    // Deterministic schedule inputs: 50% deposit, 3 days after confirm, balance
    // 7 days before arrival, €200 refundable borg, €150/night.
    await sql`
      INSERT INTO setting (key, value) VALUES
        ('price_per_night', '150'),
        ('deposit_percentage', '50'),
        ('deposit_deadline_days', '3'),
        ('balance_due_days_before_arrival', '7'),
        ('security_deposit_amount', '200')
      ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value
    `;
    await fetch("http://localhost:3000/api/dev/revalidate/settings", {
      method: "POST",
    });
  });

  test.afterAll(async () => {
    // Restore the seed default so other specs see a borg-free schedule.
    const sql = neon(process.env.DATABASE_URL!);
    await sql`
      INSERT INTO setting (key, value) VALUES ('security_deposit_amount', '0')
      ON CONFLICT (key) DO UPDATE SET value = '0'
    `;
    await fetch("http://localhost:3000/api/dev/revalidate/settings", {
      method: "POST",
    });
  });

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

  // Clicks a day, navigating forward month-by-month until it is visible — robust
  // to check-in/out falling outside the initially rendered month.
  async function pickDay(
    page: import("@playwright/test").Page,
    d: Date,
  ): Promise<void> {
    const selector = `button[aria-label="${toAriaLabel(d)}"]`;
    for (let i = 0; i < 12; i++) {
      const btn = page.locator(selector).first();
      if ((await btn.count()) > 0 && (await btn.isVisible())) {
        await btn.click();
        return;
      }
      await page.locator(".rdp-button_next").click();
    }
    throw new Error(`day not selectable: ${toAriaLabel(d)}`);
  }

  async function selectRange(
    page: import("@playwright/test").Page,
    checkinOffset: number,
    nights: number,
  ): Promise<void> {
    const checkin = new Date();
    checkin.setDate(checkin.getDate() + checkinOffset);
    const checkout = new Date(checkin);
    checkout.setDate(checkout.getDate() + nights);
    await pickDay(page, checkin);
    await pickDay(page, checkout);
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
  }

  test("split presentation: deposit + balance-with-borg rows for a stay well in advance", async ({
    page,
  }) => {
    await page.goto("/nl/book");
    await expect(page.getByRole("grid")).toBeVisible();
    // Arrival 30 days out → balance deadline (arrival − 7) is far past the
    // deposit deadline (today + 3), so the schedule splits in two.
    await selectRange(page, 30, 4);

    await expect(page.getByText("Betaling in termijnen")).toBeVisible();
    await expect(page.getByText("Aanbetaling (50%)")).toBeVisible();
    await expect(page.getByText("Restbetaling incl. borg")).toBeVisible();
    await expect(page.getByText("ontvangt u na afloop")).toBeVisible();
    // The collapsed single-payment line must NOT appear for a split schedule.
    await expect(page.getByText("Volledig bedrag incl. borg")).toHaveCount(0);
  });

  test("collapsed presentation: single full-amount row for a short-notice stay", async ({
    page,
  }) => {
    await page.goto("/nl/book");
    await expect(page.getByRole("grid")).toBeVisible();
    // Arrival 2 days out → balance deadline (arrival − 7) is on/before the
    // deposit deadline (today + 3), so the schedule collapses to one payment.
    await selectRange(page, 2, 3);

    await expect(page.getByText("Volledig bedrag incl. borg")).toBeVisible();
    await expect(page.getByText("ontvangt u na afloop")).toBeVisible();
    // The 50/50 split must NOT appear for a short-notice schedule.
    await expect(page.getByText("Aanbetaling (50%)")).toHaveCount(0);
  });
});
