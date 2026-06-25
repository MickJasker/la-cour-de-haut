# ADR-0010: Reviews feature design decisions

**Status:** Accepted

## Context

Issue #7 specifies the reviews feature end-to-end (admin CRUD at `/admin/reviews` + public section), but left several design questions open before implementation could begin. This ADR records the decisions reached during a pre-implementation design review.

See [ADR-0002](./0002-reviews-own-db-no-scraper.md) for the decision to store reviews in the site's own DB (no scraper), and [ADR-0003](./0003-jsonb-i18n-columns.md) for the jsonb i18n column pattern.

## Decisions

### 1. `body` stored as `jsonb` from day one

**Decision:** `body jsonb` + `body_source jsonb`, consistent with ADR-0003. Only the `nl` key is populated at launch; auto-translate (EN/FR/DE) is a later slice.

**Rationale:** A `TEXT → jsonb` migration on a live table is non-trivial (column rename, backfill, application changes). Starting with `jsonb` costs nothing now — the admin form writes `{ nl: value }`, the public page reads `body.nl`, and the future translate action slots in without a schema change. Inconsistency with every other translatable entity in the project would create a special case to undo later.

**Schema:**

```typescript
body:       jsonb("body").$type<{ nl: string; en?: string; fr?: string; de?: string }>().notNull(),
bodySource: jsonb("body_source").$type<{ nl: 'human' | 'machine'; en?: ...; fr?: ...; de?: ... }>().notNull(),
```

### 2. `source` as `TEXT` with a Zod allowlist

**Decision:** `source TEXT NOT NULL`, validated at the application boundary with `z.enum(['airbnb', 'natuurhuisje', 'direct'])`.

**Rationale:** Postgres `ENUM` types cannot be extended inside a transaction (`ALTER TYPE … ADD VALUE`), making them awkward in Drizzle migrations. A `TEXT` column with a Zod enum gives identical validation at form and server-action boundaries with zero migration cost when a new platform (e.g. `booking_com`, `google`) is added. This is a single-owner admin tool — no risk of garbage data bypassing the Zod layer.

**Display labels** (DB value → UI string):

```typescript
const SOURCE_LABELS = {
  airbnb: "AirBnB",
  natuurhuisje: "Natuurhuisje",
  direct: "direct",
} as const;
```

### 3. Sort order managed via drag-and-drop

**Decision:** The admin list uses `@dnd-kit/sortable` for drag-and-drop reordering. On drop, a server action receives the full reordered `id[]` array and batch-updates `sort_order` in a single write.

**Rationale:** Review volume is low (10–20 entries), but reordering is a real owner task. Up/down arrows are slow for anything beyond adjacent swaps; manual number input is confusing for a non-technical owner. DnD is the most intuitive UX for this scale. `@dnd-kit` is the idiomatic choice for React — lightweight, accessible, no global drag API side-effects.

`@dnd-kit/core`, `@dnd-kit/sortable`, and `@dnd-kit/utilities` are new dependencies (not yet in `package.json`).

### 4. Public section layout (Figma-spec)

**Decision:** 3-column responsive card grid on a warm beige section background. Each card shows:

- Gold star rating (rendered stars, not a number)
- Quoted body text
- Attribution bottom-right: `– {author_name}` / `{review_date} – via {SOURCE_LABELS[source]}`

All published reviews are shown (no "show more"). No carousel — carousels hide content and require JS that conflicts with `cacheComponents` prerendering.

**Placement:** After the gallery, before the POIs section — reviews build trust immediately after the owner's pitch.

### 5. NL-only body falls back for all locales

**Decision:** The public page reads `body[locale] ?? body.nl`. Non-NL visitors see the Dutch body until the auto-translate slice ships.

**Rationale:** Hiding the reviews section on EN/FR/DE pages wastes real social proof for the majority of visitors. The fallback is a one-liner and disappears silently once translation keys are populated.

### 6. Admin rating input: star-click picker

**Decision:** A small `"use client"` star-picker component — five `<button>` elements that set local state and write to a hidden `<input name="rating">`. No third-party library.

**Rationale:** The owner copy-pastes from platform emails that show a star rating visually. A star picker lets them match what they see without translating stars to a number. The component is trivial to implement and consistent with the visual language of the public display.

## Full schema shape

```typescript
export const review = pgTable("review", {
  id: text("id").primaryKey(),
  authorName: text("author_name").notNull(),
  rating: integer("rating").notNull(), // 1–5
  reviewDate: date("review_date").notNull(),
  source: text("source").notNull(), // 'airbnb' | 'natuurhuisje' | 'direct'
  body: jsonb("body")
    .$type<{ nl: string; en?: string; fr?: string; de?: string }>()
    .notNull(),
  bodySource: jsonb("body_source")
    .$type<{
      nl: "human" | "machine";
      en?: "human" | "machine";
      fr?: "human" | "machine";
      de?: "human" | "machine";
    }>()
    .notNull(),
  published: boolean("published").notNull().default(false),
  sortOrder: integer("sort_order").notNull().default(0),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});
```

## Consequences

- The `body` column is immediately compatible with the future auto-translate action — no migration required when that slice ships.
- Adding a new review source (e.g. `booking_com`) requires only a Zod enum update and a `SOURCE_LABELS` entry — no schema migration.
- `@dnd-kit/core` + `@dnd-kit/sortable` + `@dnd-kit/utilities` must be added to `package.json`.
- EN/FR/DE visitors will see Dutch review text at launch; this is a known, accepted gap until the translate slice ships.
