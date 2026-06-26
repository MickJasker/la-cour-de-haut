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
    await expect(page.getByRole("radio", { name: "1 gast" })).toBeVisible();
    await expect(page.getByRole("radio", { name: "2 gasten" })).toBeVisible();
    await expect(page.getByRole("grid")).toBeVisible();
    await expect(page.getByRole("button", { name: "Boek nu" })).toBeVisible();
  });

  test("submitting empty form shows required-field errors", async ({
    page,
  }) => {
    await page.getByRole("button", { name: "Boek nu" }).click();

    await expect(page.getByText("Dit veld is verplicht")).toBeVisible();
    await expect(
      page.getByText("Voer een geldig e-mailadres in"),
    ).toBeVisible();
  });

  test("invalid email shows email validation error", async ({ page }) => {
    await page.getByLabel("Voor- en achternaam").fill("Test Gebruiker");
    await page.getByLabel("E-mailadres").fill("notanemail");
    await page.getByRole("button", { name: "Boek nu" }).click();

    await expect(
      page.getByText("Voer een geldig e-mailadres in"),
    ).toBeVisible();
    // Name error should not appear since the name was filled
    await expect(page.getByText("Dit veld is verplicht")).not.toBeVisible();
  });

  test("valid submission shows success message", async ({ page }) => {
    await page.getByLabel("Voor- en achternaam").fill("Test Gebruiker");
    await page.getByLabel("E-mailadres").fill("test@example.com");
    await page.getByLabel("Telefoonnummer").fill("+32123456789");

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
