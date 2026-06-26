@AGENTS.md

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
