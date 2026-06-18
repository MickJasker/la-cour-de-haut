import { test, expect, type Page } from "@playwright/test";
import {
  blockedDates,
  blockedMonth,
  checkoutDate,
} from "./availability-fixture";

// The global setup seeds an iCal source with cachedIntervals covering
// a dynamic 4-night blocked interval (end is exclusive). These dates must appear
// as disabled in the booking calendar.

const TARGET_YEAR = blockedMonth.year;
const TARGET_MONTH_INDEX = blockedMonth.monthIndex;

function getMonthDistanceToTarget(): number {
  const now = new Date();
  return (
    (TARGET_YEAR - now.getFullYear()) * 12 +
    (TARGET_MONTH_INDEX - now.getMonth())
  );
}

async function goToTargetMonth(page: Page) {
  const nextButton = page.locator(".rdp-button_next");
  const monthsToAdvance = getMonthDistanceToTarget();
  expect(monthsToAdvance).toBeGreaterThanOrEqual(0);

  for (let i = 0; i < monthsToAdvance; i++) {
    await nextButton.click();
  }

  const sampleDate = blockedDates[0]!;

  // Ensure we're on the target month by checking a known in-month date exists.
  await expect(dayButtonForDate(page, sampleDate)).toBeVisible();
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
    await goToTargetMonth(page);

    await expect(dayButtonForDate(page, blockedDates[0]!)).toBeVisible();
    await expect(dayButtonForDate(page, checkoutDate)).toBeVisible();
  });

  test("blocked iCal dates are disabled in the calendar", async ({ page }) => {
    await goToTargetMonth(page);

    for (const date of blockedDates) {
      const dayButton = dayButtonForDate(page, date);
      await expect(dayButton).toBeDisabled();
    }
  });

  test("checkout day (end of blocked range) is not disabled", async ({
    page,
  }) => {
    await goToTargetMonth(page);

    // The checkout day equals DTEND (exclusive) and should remain available.
    const checkoutButton = dayButtonForDate(page, checkoutDate);
    await expect(checkoutButton).not.toBeDisabled();
  });
});
