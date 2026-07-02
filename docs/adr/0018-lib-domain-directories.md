# ADR-0018: Domain directories in `src/lib`, mirroring CONTEXT.md

**Status:** Accepted

## Context

`src/lib` had grown to ~57 flat files (~6,300 lines) where booking, translation, content-authoring, auth, media, and generic helpers interleaved alphabetically. The individual modules were fine — small export surfaces hiding real logic (`booking-lifecycle.ts` exported one function) — but finding which file owned a concept meant scanning the whole directory, and names like `dal.ts` (which exported only the `verifySession` auth guard) or the `src/i18n/translate.ts` / `src/lib/translate.ts` collision made discovery worse.

## Decision

`src/lib` is organized into domain subdirectories that map 1:1 to CONTEXT.md's domain sections, so a reader can go from docs to code without translation:

- `booking/` — booking lifecycle, state machine, availability, iCal fetch, calendar-day math, bank-transfer email, admin dashboard
- `translation/` — the translate content model: machine-translate seam + adapters, localized-field/detail resolution, review i18n
- `content/` — authored content: the save pipeline, Lexical rich text, slugs, POI queries
- `media/` — Vercel Blob delete guard, gallery persistence
- `settings/` — key-value settings accessors + registry (ADR-0006)
- `auth/` — Better Auth server/client setup, `session.ts` (`verifySession`, formerly `dal.ts`)
- lib root — only generic cross-domain helpers (`utils`, `phone`, `countries`, `safe-url`, `cache-tags`)

**Placement rule:** a new lib module goes in the directory matching its CONTEXT.md domain section; only helpers with no domain home stay at the root. File basenames drop a prefix the directory already provides (`booking/lifecycle.ts`, `settings/registry.ts`, `translation/google-adapter.ts`).

**No barrel `index.ts` files.** Imports name the file directly (`@/lib/booking/lifecycle`). A barrel would let a client component transitively pull `server-only` modules — `auth/` deliberately holds both `auth.ts` (server-only) and `auth-client.ts` (browser) — and the same hazard exists wherever a directory mixes runtimes.

## Considered options

- **Split large files into more files** — rejected: modules are deep (1–3 exports each); splitting would smear small interfaces across shallow files. The pain was the flat namespace, not file size.
- **Feature directories at `src/` level** (`src/booking/` next to `app/`) — rejected: far bigger blast radius (app/components conventions) for the same discoverability win.
- **Barrel files per directory** — rejected for the server/client boundary hazard above and needless compile-graph coupling.

## Consequences

- Older ADRs (≤ 0017) reference pre-move paths like `src/lib/lexical/…`; they are historical records and are not rewritten. CONTEXT.md, as a living document, is updated.
- `vi.mock()` specifiers must keep matching the module-under-test's import specifier form (e.g. `@/lib/settings/settings`), as before.
