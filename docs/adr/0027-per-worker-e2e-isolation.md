# ADR-0027: Per-worker Neon branch + server for E2E isolation

**Status:** Accepted

## Context

Playwright ran spec files in parallel workers against **one shared database** served by
**one** Next server. Several specs `TRUNCATE booking_request` in `beforeEach`, and the
dashboard "all-clear" tests assert _global_ state (`Alles in orde`). Concurrent workers
stomped on each other: a parallel `TRUNCATE` deleted a just-submitted row mid-test, a
parallel `requested` row leaked into the dashboard's global read. `retries: 1` masked
it ([#88](https://github.com/MickJasker/la-cour-de-haut/issues/88)).

Scoped cleanup can't fix this: the all-clear tests need an _exclusively empty_
`booking_request`.

## Decision

Each worker owns a private **Neon branch** and a private **`next start` server** bound to it.
`e2e/global-setup.ts` builds both:

1. Fork a **template** branch from the project's default branch; run `pnpm build` (which
   migrates) against it; truncate and seed the owner + test iCal source once.
2. Fork `E2E_WORKERS` (default 3) **worker branches** from the template.
3. Start `next start -p $((E2E_PORT + i))` per worker branch (`E2E_PORT` defaults to 3100).
4. Sign the owner in once and copy the `session` row into every worker branch; one saved
   cookie then works on every port (same secret, same user id, cookies aren't port-scoped).
5. Teardown (returned from `globalSetup`, runs on pass or fail) kills servers and deletes all branches.

Workers are told which branch/server is theirs through `applyWorkerEnv()` (`e2e/isolation.ts`),
called from `playwright.config.ts`. Playwright re-evaluates the config in each worker with
`TEST_PARALLEL_INDEX` set, so it points `DATABASE_URL` and `E2E_BASE_URL` at that worker's
pair. Specs keep reading `process.env.DATABASE_URL`; they use `process.env.E2E_BASE_URL`
for direct fetches (never a hardcoded port).

## Considered options

- **`workers: 1`** — deterministic and trivial, but serialises the whole suite.
- **Serial project for the contending specs** — keeps some parallelism, but every new spec
  that touches global state must remember to opt in; the hazard stays latent.
- **Schema per worker** — Neon's HTTP driver/pooler doesn't reliably honour `search_path`, and
  migrations would have to run per schema.
- **Branch per worker, one shared server** — impossible: the server reads one `DATABASE_URL`.
  It also leaves the server's `'use cache'` shared between workers, which per-worker servers fix too.

## Consequences

- Cross-worker contention is gone by construction, including shared `'use cache'` state.
- The suite **never touches the DB in `.env.local`**: it only talks to its own throwaway
  branches. This removes the old "don't run e2e against your dev DB" hazard.
- `NEON_API_KEY` and `NEON_PROJECT_ID` are now required to run e2e anywhere (previously CI only).
  The CI job no longer creates its own branch.
- Local runs always use a production build (`E2E_SKIP_BUILD=1` reuses an existing `.next`
  built by this suite). `pnpm dev` is no longer the e2e target.
- Each run consumes `E2E_WORKERS + 1` branches; mind the project's branch limit. A hard-killed
  run (SIGKILL) can leak `e2e-*` branches; delete them in the Neon console.
