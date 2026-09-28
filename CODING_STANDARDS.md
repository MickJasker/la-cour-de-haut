# Coding Standards

Code-level conventions for this repo — how code should be written, not what to build. For process, commands, and environment rules see `CLAUDE.md`; for domain model and booking lifecycle see `CONTEXT.md`.

This file is the **Standards** source for `/code-review`: it cites the rule + file when a diff violates one of these. Where a rule below and the Fowler smell baseline in `/code-review` disagree, this file wins.

## TypeScript

- **No `as unknown as Type` double casts.** Type values honestly against the real library type — read the `.d.ts` instead of laundering through `unknown`.
- **No feature flags or compat shims for internal code.** Change the call site; don't add a parallel path "for now."

## React 19

- **Prefer the React 19 primitives over `useState`/`useEffect` equivalents** for async UI state: `useOptimistic`, `useTransition`, `useActionState`, `useFormStatus`. See `src/app/admin/(private)/pages/pages-client.tsx` for `useOptimistic` + `useActionState` together.
- **Never suppress `exhaustive-deps` with `eslint-disable`.** If a `useEffect` dependency looks wrong, that's a sign the effect is structured wrong — find a structural fix (derive during render, move state up, use an event handler) instead of silencing the linter.
- **Server Actions return a typed `*ActionState`**, not a bare value or thrown error for expected failures (validation, unavailable dates). Match the shape in `src/app/[locale]/book/action.ts`: a typed state object, `ServerValidateError` caught and mapped to `formState`, unexpected errors rethrown.

## Caching

- **Default to `"use cache"` (+ `generateStaticParams` where applicable) over `<Suspense>`** for reads. Reach for `Suspense` only when the read is genuinely request-time and can't be cached — e.g. `getBusyIntervals` for booking availability.
- Under Cache Components, a widget that reads `useSearchParams` (or similar client-only state) needs a `useSyncExternalStore` mounted-gate before it hydrates — `Suspense` alone still logs build noise.

## Data / Postgres

- **Canonicalize key order before comparing a `jsonb` column's contents.** Postgres reorders object keys on write, so a raw `JSON.stringify(a) === JSON.stringify(b)` diff against a jsonb-stored value will always report "changed."

## Naming & file layout

- Filenames: kebab-case (`source-form.tsx`, `use-is-hydrated.ts`).
- Hooks: `use-*.ts(x)`, colocated in `src/hooks/`.
- Tests: colocated next to the source as `<name>.test.ts(x)`, not in a separate `__tests__/` tree.
- Server Actions: exported function names end in `Action` (`submitBookingAction`, `getPricePerNightAction`).

## Comments

- Default to none. Only write one when the _why_ is non-obvious — a hidden constraint, a subtle invariant, a workaround for a specific bug. If removing it wouldn't confuse a future reader, don't write it.
- Don't reference issue/PR numbers, task names, or "added for the X flow" in comments — that belongs in the commit message or PR description and rots as the code moves on.
- Don't describe _what_ the code does when a well-named identifier already says so.

## Scope discipline

- Don't add abstractions, config knobs, or error handling for scenarios that can't happen here — a single-owner inquiry funnel, not a multi-tenant platform. Match the size of a fix to the size of the bug.
- Three similar lines beat a premature shared helper. Don't design for hypothetical future requirements (e.g. a second gîte, online payments) unless asked.

## i18n

- Native i18n only (`src/i18n/`) — no `next-intl`.
- Each `[locale]` segment is its own root layout. A locale switch must be a plain `<a>`, never a soft `<Link>` — a soft nav between locales leaves a duplicate hidden shell in production (PPR).

## UI changes

- Preserve existing layout/design system (masonry, spacing, component structure) when fixing bugs or tests — never flatten it to make a test pass. Screenshot and get sign-off before calling a visual change done; green tests don't mean the design survived. See `CLAUDE.md` → UI / Design Guidelines.
