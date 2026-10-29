import type { Page } from "@playwright/test";

const DUTCH_DAYS = [
  "zondag",
  "maandag",
  "dinsdag",
  "woensdag",
  "donderdag",
  "vrijdag",
  "zaterdag",
];

const DUTCH_MONTHS = [
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

/** react-day-picker's day-button aria-label in Dutch (the e2e locale). */
export function toAriaLabel(d: Date): string {
  return `${DUTCH_DAYS[d.getDay()]} ${d.getDate()} ${DUTCH_MONTHS[d.getMonth()]} ${d.getFullYear()}`;
}

/**
 * Clicks a day in the booking calendar, paging forward until it is visible.
 * The picker only renders the current month, so a stay that starts or ends in
 * the next month is unreachable without paging — relative dates ("today + 4")
 * hit that near the end of every month.
 */
export async function pickDay(page: Page, d: Date): Promise<void> {
  const selector = `button[aria-label="${toAriaLabel(d)}"]`;
  for (let i = 0; i < 12; i++) {
    const btn = page.locator(selector).first();
    if ((await btn.count()) > 0 && (await btn.isVisible())) {
      await btn.click();
      return;
    }
    await page.locator(".rdp-button_next").click();
  }
  throw new Error(`day not selectable: ${toAriaLabel(d)}`);
}
