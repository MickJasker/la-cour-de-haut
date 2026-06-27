import { test, expect } from "@playwright/test";

test.describe("settings: admin", () => {
  test.use({ storageState: "e2e/.auth/owner.json" });

  test("settings page is accessible", async ({ page }) => {
    await page.goto("/admin/settings");
    await expect(
      page.getByRole("heading", { name: /instellingen/i }),
    ).toBeVisible();
  });

  test("shows inline error when IBAN is cleared and saved", async ({
    page,
  }) => {
    await page.goto("/admin/settings");
    await page.getByLabel(/iban/i).clear();
    await page.getByRole("button", { name: /opslaan/i }).click();
    await expect(
      page.locator("[data-field='iban']").getByText("Vereist"),
    ).toBeVisible();
  });

  test("shows inline error when price per night is invalid", async ({
    page,
  }) => {
    await page.goto("/admin/settings");
    await page.getByLabel(/prijs per nacht/i).fill("-1");
    await page.getByRole("button", { name: /opslaan/i }).click();
    await expect(
      page.locator("[data-field='price_per_night']").getByText(/positief/i),
    ).toBeVisible();
  });

  test("owner can save valid settings", async ({ page }) => {
    await page.goto("/admin/settings");
    await page.getByLabel(/rekeninghouder/i).fill("La Cour de Haut");
    await page.getByLabel(/iban/i).fill("NL91ABNA0417164300");
    await page.getByLabel(/banknaam/i).fill("ABN AMRO");
    await page.getByLabel(/prijs per nacht/i).fill("120");
    await page.getByLabel(/betalingstermijn/i).fill("7");
    await page.getByRole("button", { name: /opslaan/i }).click();
    await expect(page.getByText(/opgeslagen/i)).toBeVisible();
  });
});
