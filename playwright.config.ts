import { defineConfig, devices } from "@playwright/test";
import { applyWorkerEnv, WORKER_COUNT } from "./e2e/isolation";

try {
  process.loadEnvFile(".env.local");
} catch {}

// Every worker gets its own Neon branch and its own `next start` server (ADR-0027);
// global-setup creates them. This (re)runs in each worker process, where it points
// DATABASE_URL / E2E_BASE_URL at that worker's branch and server.
applyWorkerEnv();

export default defineConfig({
  testDir: "./e2e",
  // `*.test.ts` in e2e/ are Vitest unit tests for the harness itself.
  testIgnore: /\.test\.ts$/,
  globalSetup: "./e2e/global-setup.ts",
  workers: WORKER_COUNT,
  retries: 1,
  use: {
    baseURL: process.env.E2E_BASE_URL,
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
