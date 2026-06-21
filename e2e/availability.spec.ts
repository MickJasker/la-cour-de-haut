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

async function goToMonthOf(page: Page, dateString: string) {
  const [year, month] = dateString.split("-").map(Number);
  const now = new Date();
  const monthsToAdvance =
    (year - now.getFullYear()) * 12 + (month - 1 - now.getMonth());
  expect(monthsToAdvance).toBeGreaterThanOrEqual(0);
  const nextButton = page.locator(".rdp-button_next");
  for (let i = 0; i < monthsToAdvance; i++) {
    await nextButton.click();
  }
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
    // checkoutDate may be in the next month when the blocked interval spans a
    // month boundary — its visibility is verified in the dedicated checkout test.
  });

  test("blocked iCal dates are disabled in the calendar", async ({ page }) => {
    await goToTargetMonth(page);
    let displayedMonth = blockedMonth.monthIndex;

    for (const date of blockedDates) {
      const dateMonth = parseInt(date.split("-")[1]!, 10) - 1; // 0-indexed
      while (displayedMonth < dateMonth) {
        await page.locator(".rdp-button_next").click();
        displayedMonth++;
      }
      await expect(dayButtonForDate(page, date)).toBeDisabled();
    }
  });

  test("checkout day (end of blocked range) is not disabled", async ({
    page,
  }) => {
    // Navigate to the month that actually contains the checkout date — it may
    // differ from the blocked-start month when the interval spans a boundary.
    await goToMonthOf(page, checkoutDate);

    // The checkout day equals DTEND (exclusive) and should remain available.
    const checkoutButton = dayButtonForDate(page, checkoutDate);
    await expect(checkoutButton).not.toBeDisabled();
  });
});
