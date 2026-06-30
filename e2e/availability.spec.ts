import { test, expect, type Page } from "@playwright/test";
import { blockedDates, checkoutDate } from "./availability-fixture";

// The global setup seeds an iCal source with cachedIntervals covering
// a dynamic 4-night blocked interval (end is exclusive). These dates must appear
// as disabled in the booking calendar.

// The calendar's initial month is not always "now": react-day-picker clamps it
// up to `startMonth` (book-form.tsx sets startMonth to tomorrow), which rolls
// into next month whenever the test happens to run on the last day of a month.
// Click forward until the target date is actually visible instead of
// pre-computing a fixed click count that assumes a specific starting month.
async function navigateToDate(page: Page, dateString: string) {
  const nextButton = page.locator(".rdp-button_next");
  const target = dayButtonForDate(page, dateString);
  // Calendar window is startMonth (~tomorrow) .. +12 months, so 13 clicks is
  // always enough regardless of which month the calendar opens on.
  for (let i = 0; i < 13 && !(await target.isVisible()); i++) {
    await nextButton.click();
  }
  await expect(target).toBeVisible();
}

function toDataDay(dateString: string): string {
  const [year, month, day] = dateString
    .split("-")
    .map((part) => parseInt(part, 10));
  return `${day}-${month}-${year}`;
}

function dayButtonForDate(page: Page, dateString: string) {
  return page
    .getByRole("grid")
    .locator(`button[data-day='${toDataDay(dateString)}']`);
}

test.describe("availability — iCal source busy dates block the calendar", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/nl/book");
    await expect(page.getByRole("grid")).toBeVisible();
  });

  test("navigates to the month containing blocked dates", async ({ page }) => {
    await navigateToDate(page, blockedDates[0]!);
    // checkoutDate may be in the next month when the blocked interval spans a
    // month boundary — its visibility is verified in the dedicated checkout test.
  });

  test("blocked iCal dates are disabled in the calendar", async ({ page }) => {
    for (const date of blockedDates) {
      await navigateToDate(page, date);
      await expect(dayButtonForDate(page, date)).toBeDisabled();
    }
  });

  test("checkout day (end of blocked range) is not disabled", async ({
    page,
  }) => {
    // The checkout day equals DTEND (exclusive) and should remain available.
    await navigateToDate(page, checkoutDate);
    const checkoutButton = dayButtonForDate(page, checkoutDate);
    await expect(checkoutButton).not.toBeDisabled();
  });
});
