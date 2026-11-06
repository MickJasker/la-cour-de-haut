// Per-worker isolation model (ADR-0027): every Playwright worker owns a private
// Neon branch AND a private `next start` server pointing at it, so the specs'
// `TRUNCATE`s and global-state assertions can't race across workers.
//
// This module is imported by `playwright.config.ts`, which Playwright evaluates
// in the main process *and again in every worker process*. Keep it free of
// side-effects other than `applyWorkerEnv()`.

/** How many workers (= branches = servers) a run uses. */
export const WORKER_COUNT = Number(process.env.E2E_WORKERS ?? 3);

/** Worker N's server listens on `BASE_PORT + N`. Distinct from `pnpm dev` (3000). */
export const BASE_PORT = Number(process.env.E2E_PORT ?? 3100);

/** Env var carrying the JSON array of per-worker pooled DB URLs (set by global-setup). */
export const WORKER_DB_URLS_KEY = "E2E_WORKER_DB_URLS";

export const workerBaseUrl = (index: number) =>
  `http://localhost:${BASE_PORT + index}`;

/**
 * Point this process at its worker's server and database.
 *
 * In a worker process Playwright has already set `TEST_PARALLEL_INDEX` (stable
 * across worker restarts, unlike `TEST_WORKER_INDEX`), so specs can keep using
 * `process.env.DATABASE_URL` and `process.env.E2E_BASE_URL` unchanged.
 * In the main process there is no index: only the base URL is set, and
 * `DATABASE_URL` is left alone (global-setup builds its own env explicitly).
 */
export function applyWorkerEnv() {
  const parallelIndex = process.env.TEST_PARALLEL_INDEX;
  const index = Number(parallelIndex ?? 0);
  process.env.E2E_BASE_URL = workerBaseUrl(index);

  const urls = process.env[WORKER_DB_URLS_KEY];
  if (parallelIndex !== undefined && urls) {
    const url = (JSON.parse(urls) as string[])[index];
    // e.g. `--workers` above E2E_WORKERS: fail loudly rather than fall back to
    // whatever DATABASE_URL .env.local holds (your dev DB).
    if (!url)
      throw new Error(
        `No e2e database for worker ${index}: raise E2E_WORKERS instead of passing --workers`,
      );
    process.env.DATABASE_URL = url;
  }
}
