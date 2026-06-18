import { test as setup, expect } from "@playwright/test";

// In dev mode Next.js compiles routes lazily on first request. The first
// client-side navigation to the (.)book intercepting route triggers an
// on-demand compile that, on a cold CI runner, can exceed the default 5 s
// expect timeout — flaking whichever test happens to hit it first.
//
// Warming the route here (in the setup project, which all test projects depend
// on) compiles it once before any real test runs, so per-test assertions can
// keep tight timeouts and fail fast on genuine regressions.
setup("warm up the booking intercepting route", async ({ page }) => {
  await page.goto("/nl");
  await page.getByRole("banner").getByRole("link", { name: /boek/i }).click();
  await expect(page.getByRole("dialog")).toBeVisible({ timeout: 60_000 });
});
