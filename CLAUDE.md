@AGENTS.md

## Pre-Commit / CI Checklist

Always run typecheck, lint, format, and the relevant tests locally BEFORE committing or pushing. Verify CI will pass — do not push code that fails build/typecheck/format.

The lefthook `pre-commit` hook already runs **format, lint, and typecheck** automatically on staged files. Tests and the production build are **not** in the hook — run those yourself:

- `pnpm tsc --noEmit` — TypeScript typecheck (also run by the pre-commit hook; there is no `typecheck` npm script)
- `pnpm lint` — ESLint (also run by the pre-commit hook)
- `pnpm format:check` — Prettier (use `pnpm format` to auto-fix; the hook auto-formats staged files)
- `pnpm test` — Vitest unit tests (not in the hook)
- `pnpm test:e2e` — Playwright, for changes touching affected flows (not in the hook)
- `pnpm build` — runs `db:migrate` then `next build` (not in the hook)

## Environment & Config

Use existing env var names already present in the codebase (e.g., `NEXT_PUBLIC_APP_URL`) — grep for existing names before introducing new ones. Never assume a secret like `DATABASE_URL` exists in CI/GitHub without verifying it is set.

## UI / Design Guidelines

Preserve existing UI/layout (e.g., masonry, design system) when fixing bugs or tests — never flatten or simplify the design just to make tests pass. Ask before changing visual structure.

## Planning / Design Workflow

When a feature has design decisions to lock down, run a guided requirements interview (grill), capture decisions in an ADR (`docs/adr/`), and update the GitHub issue ONLY after explicit user approval.

## E2E testing patterns

- `clearBookings()` truncates `booking_request` only — `ical_source` is seeded by global-setup; seed test iCal rows with `ON CONFLICT (id) DO UPDATE` and a fixed ID, never truncate the table in tests
- `getByText("some heading")` matches substrings — use `getByRole("heading", { name })` for section headings to avoid false positives against body copy containing the same words
- `booking-lifecycle.spec.ts` has a `beforeAll` that seeds `requested` bookings without `afterAll` cleanup; add `test.describe.configure({ mode: "serial" })` to any spec whose all-clear state can be dirtied by parallel workers

## Agent skills

### Issue tracker

Issues live in GitHub Issues, using the `gh` CLI. See `docs/agents/issue-tracker.md`.

### Triage labels

Default label vocabulary (`needs-triage`, `needs-info`, `ready-for-agent`, `ready-for-human`, `wontfix`). See `docs/agents/triage-labels.md`.

### Domain docs

Single-context layout — one `CONTEXT.md` + `docs/adr/` at the repo root. See `docs/agents/domain.md`.
