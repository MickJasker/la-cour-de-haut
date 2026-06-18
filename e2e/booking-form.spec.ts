import { test, expect } from "@playwright/test";

test.describe("booking form — standalone page (/nl/book)", () => {
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

    // Select a 1-night stay: click the first two available date cells
    const availableDates = page
      .getByRole("grid")
      .locator("button:not([disabled])");
    await availableDates.nth(0).click(); // check-in
    await availableDates.nth(1).click(); // check-out (next day = 1 night)

    await page.getByRole("button", { name: "Boek nu" }).click();

    await expect(
      page.getByText(
        "Bedankt voor uw boeking! We nemen binnenkort contact met u op.",
      ),
    ).toBeVisible();
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
