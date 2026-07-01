import { defineConfig, devices } from "@playwright/test";

try {
  process.loadEnvFile(".env.local");
} catch {}

export default defineConfig({
  testDir: "./e2e",
  globalSetup: "./e2e/global-setup.ts",
  webServer: {
    // On CI, run e2e against a real production build. Cache Components / PPR
    // only behave correctly when built (`'use cache'` is real, static shells are
    // prerendered, routes are precompiled so there's no lazy-compile latency
    // that flakes timeouts under parallel workers). Locally we keep `pnpm dev`
    // for fast iteration; reuse an already-running dev server.
    command: process.env.CI ? "pnpm build && pnpm start" : "pnpm dev",
    url: "http://localhost:3000",
    reuseExistingServer: !process.env.CI,
    // A production build can take a couple of minutes on a cold CI runner.
    timeout: 180_000,
    // Inject E2E_TESTING so the server activates the deterministic translation
    // stub ("<text> [locale]") instead of calling real Google Translate.
    // Matches the CI environment so `pnpm test:e2e` passes locally without
    // needing the var set in the shell.
    // NEXT_PUBLIC_E2E_TESTING is the client-visible counterpart, read by
    // upload-image.ts to skip @vercel/blob/client's upload() in favor of a
    // same-origin stub (see src/app/api/admin/blob-upload/route.ts) — it must
    // be set at build time (`pnpm build`, run by this command on CI) to be
    // inlined into the client bundle.
    env: { E2E_TESTING: "1", NEXT_PUBLIC_E2E_TESTING: "1" },
  },
  retries: 1,
  use: {
    baseURL: "http://localhost:3000",
    locale: "nl",
  },
  projects: [
    {
      name: "setup",
      testMatch: /\.setup\.ts/,
    },
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
      dependencies: ["setup"],
    },
  ],
});
