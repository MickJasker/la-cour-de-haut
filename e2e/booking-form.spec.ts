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
    // Country is a combobox (role="combobox"), preselected to NL on /nl
    await expect(page.getByRole("combobox")).toBeVisible();
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
    await page.getByLabel("E-mailadres").fill("notanemail");
    await page.getByRole("button", { name: "Boek nu" }).click();

    await expect(
      page.getByText("Voer een geldig e-mailadres in"),
    ).toBeVisible();
    // All required text fields are filled (country preselects to NL), so the
    // "required" message should not appear anywhere — only the email is invalid.
    await expect(page.getByText("Dit veld is verplicht")).not.toBeVisible();
  });

  test("valid submission shows success message", async ({ page }) => {
    await page.getByLabel("Voor- en achternaam").fill("Test Gebruiker");
    await page.getByLabel("E-mailadres").fill("test@example.com");
    await page.getByLabel("Telefoonnummer").fill("+32123456789");
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
    await page.getByRole("banner").getByRole("link", { name: /boek/i }).click();
    await expect(page.getByRole("dialog")).toBeVisible();

    const dialog = page.getByRole("dialog");
    // Wait for the Suspense boundary to resolve before asserting form content
    await expect(dialog.getByRole("grid")).toBeVisible();
    await expect(dialog.getByLabel("Voor- en achternaam")).toBeVisible();
    await expect(dialog.getByLabel("E-mailadres")).toBeVisible();
    await expect(dialog.getByRole("button", { name: "Boek nu" })).toBeVisible();
  });
});
