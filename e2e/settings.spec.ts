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
    // Contact (required): global-setup truncates `setting`, so these load blank
    // and must be filled or the whole form fails validation on submit.
    await page.getByLabel(/telefoonnummer/i).fill("+33612345678");
    await page.getByLabel(/e-mailadres/i).fill("info@example.com");
    await page.getByLabel(/rekeninghouder/i).fill("La Cour de Haut");
    await page.getByLabel(/iban/i).fill("NL91ABNA0417164300");
    await page.getByLabel(/banknaam/i).fill("ABN AMRO");
    await page.getByLabel(/prijs per nacht/i).fill("120");
    // Payment schedule (issue #162) — all four are required fields.
    await page.getByLabel(/aanbetaling \(%\)/i).fill("50");
    await page.getByLabel(/termijn aanbetaling/i).fill("3");
    await page.getByLabel(/restbetaling vóór aankomst/i).fill("7");
    await page.getByLabel(/borg/i).fill("200");
    await page.getByRole("button", { name: /opslaan/i }).click();
    await expect(page.getByText(/opgeslagen/i)).toBeVisible();
  });
});
