import { test, expect } from "@playwright/test";

// Footer legal-links row (ADR-0020): links to the two pinned system pages
// (`privacy`, `terms`), labeled with each page's localized title from the DB.
// System pages are seeded by global-setup's `pnpm db:migrate` (chained
// seed-pages script), so no seeding is needed here.

test.describe("footer: legal links", () => {
  test("nl footer links to privacy and terms with Dutch titles", async ({
    page,
  }) => {
    await page.request.post("/api/dev/revalidate/pages");
    await page.goto("/nl");

    const footer = page.locator("footer");
    const privacyLink = footer.getByRole("link", { name: "Privacybeleid" });
    const termsLink = footer.getByRole("link", {
      name: "Algemene voorwaarden",
    });

    await expect(privacyLink).toHaveAttribute("href", "/nl/privacy");
    await expect(termsLink).toHaveAttribute("href", "/nl/terms");

    await privacyLink.click();
    await expect(page).toHaveURL(/\/nl\/privacy$/);
    await expect(
      page.getByRole("heading", { name: "Privacybeleid" }),
    ).toBeVisible();
  });

  test("en footer links to privacy and terms with English titles", async ({
    page,
  }) => {
    await page.request.post("/api/dev/revalidate/pages");
    await page.goto("/en");

    const footer = page.locator("footer");
    const privacyLink = footer.getByRole("link", { name: "Privacy Policy" });
    const termsLink = footer.getByRole("link", {
      name: "Terms and Conditions",
    });

    await expect(privacyLink).toHaveAttribute("href", "/en/privacy");
    await expect(termsLink).toHaveAttribute("href", "/en/terms");
  });
});
