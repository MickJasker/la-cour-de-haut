import { test as setup, expect } from "@playwright/test";

// Readiness gate: exercise the (.)book intercepting route once, in the setup
// project that all test projects depend on, before any real test runs. On CI
// the web server is a production build (`next start`), so there's no lazy
// compilation — but warming the first client navigation still smooths cold-start
// timing and fails fast (with a generous timeout) if the server isn't healthy.
setup("warm up the booking intercepting route", async ({ page }) => {
  await page.goto("/nl");
  // Match the header's booking CTA by its /book href, not its label. The label
  // (sections.header `bookNow`) is intentionally reworded over time — it changed
  // from "Boek je verblijf nu" to "Reserveer nu", which silently broke the
  // previous /boek/-based name match. The href is stable across copy edits.
  await page.getByRole("banner").locator("a[href$='/book']").click();
  await expect(page.getByRole("dialog")).toBeVisible({ timeout: 60_000 });
});
