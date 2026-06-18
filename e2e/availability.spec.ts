import { test, expect } from "@playwright/test";

// The global setup seeds an iCal source with cachedIntervals covering
// 2027-07-10 → 2027-07-14 (end is exclusive). These dates must appear
// as disabled in the booking calendar.
const BLOCKED_DATES = ["2027-07-10", "2027-07-11", "2027-07-12", "2027-07-13"];

test.describe("availability — iCal source busy dates block the calendar", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/nl/book");
    await expect(page.getByRole("grid")).toBeVisible();
  });

  test("navigates to the month containing blocked dates", async ({ page }) => {
    // Navigate forward through months until July 2027 is visible
    const targetLabel = "July 2027";
    let attempts = 0;
    while (attempts < 24) {
      const heading = page
        .getByRole("grid")
        .locator("..")
        .getByText(targetLabel);
      if (await heading.isVisible()) break;
      await page.getByRole("button", { name: /next month/i }).click();
      attempts++;
    }
    await expect(
      page.getByRole("grid").locator("..").getByText(targetLabel),
    ).toBeVisible();
  });

  test("blocked iCal dates are disabled in the calendar", async ({ page }) => {
    // Navigate to July 2027
    let attempts = 0;
    while (attempts < 24) {
      const heading = page
        .getByRole("grid")
        .locator("..")
        .getByText("July 2027");
      if (await heading.isVisible()) break;
      await page.getByRole("button", { name: /next month/i }).click();
      attempts++;
    }

    for (const date of BLOCKED_DATES) {
      const [, , day] = date.split("-");
      const dayButton = page
        .getByRole("grid")
        .getByRole("button", { name: new RegExp(`^${parseInt(day)}$`) });
      await expect(dayButton).toBeDisabled();
    }
  });

  test("checkout day (end of blocked range) is not disabled", async ({
    page,
  }) => {
    // Navigate to July 2027
    let attempts = 0;
    while (attempts < 24) {
      const heading = page
        .getByRole("grid")
        .locator("..")
        .getByText("July 2027");
      if (await heading.isVisible()) break;
      await page.getByRole("button", { name: /next month/i }).click();
      attempts++;
    }

    // 2027-07-15 is the DTEND (exclusive) — it should be available
    const checkoutButton = page
      .getByRole("grid")
      .getByRole("button", { name: /^15$/ });
    await expect(checkoutButton).not.toBeDisabled();
  });
});
