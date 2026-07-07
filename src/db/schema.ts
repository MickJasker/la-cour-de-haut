import { relations } from "drizzle-orm";
import {
  pgTable,
  text,
  timestamp,
  date,
  boolean,
  index,
  pgEnum,
  integer,
  jsonb,
  numeric,
} from "drizzle-orm/pg-core";
// Type-only import: erased at compile time, so no Lexical runtime is pulled
// into the DB schema module. See ADR-0015.
import type { SerializedEditorState } from "lexical";

export type BusyInterval = { start: string; end: string };

export const user = pgTable("user", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  emailVerified: boolean("email_verified").default(false).notNull(),
  image: text("image"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at")
    .defaultNow()
    .$onUpdate(() => /* @__PURE__ */ new Date())
    .notNull(),
  // better-auth admin plugin fields
  role: text("role"),
  banned: boolean("banned").default(false),
  banReason: text("ban_reason"),
  banExpires: timestamp("ban_expires"),
});

export const session = pgTable(
  "session",
  {
    id: text("id").primaryKey(),
    expiresAt: timestamp("expires_at").notNull(),
    token: text("token").notNull().unique(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .$onUpdate(() => /* @__PURE__ */ new Date())
      .notNull(),
    ipAddress: text("ip_address"),
    userAgent: text("user_agent"),
    // better-auth admin plugin field
    impersonatedBy: text("impersonated_by"),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
  },
  (table) => [index("session_userId_idx").on(table.userId)],
);

export const account = pgTable(
  "account",
  {
    id: text("id").primaryKey(),
    accountId: text("account_id").notNull(),
    providerId: text("provider_id").notNull(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    accessToken: text("access_token"),
    refreshToken: text("refresh_token"),
    idToken: text("id_token"),
    accessTokenExpiresAt: timestamp("access_token_expires_at"),
    refreshTokenExpiresAt: timestamp("refresh_token_expires_at"),
    scope: text("scope"),
    password: text("password"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .$onUpdate(() => /* @__PURE__ */ new Date())
      .notNull(),
  },
  (table) => [index("account_userId_idx").on(table.userId)],
);

export const verification = pgTable(
  "verification",
  {
    id: text("id").primaryKey(),
    identifier: text("identifier").notNull(),
    value: text("value").notNull(),
    expiresAt: timestamp("expires_at").notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .$onUpdate(() => /* @__PURE__ */ new Date())
      .notNull(),
  },
  (table) => [index("verification_identifier_idx").on(table.identifier)],
);

export const userRelations = relations(user, ({ many }) => ({
  sessions: many(session),
  accounts: many(account),
}));

export const sessionRelations = relations(session, ({ one }) => ({
  user: one(user, {
    fields: [session.userId],
    references: [user.id],
  }),
}));

export const accountRelations = relations(account, ({ one }) => ({
  user: one(user, {
    fields: [account.userId],
    references: [user.id],
  }),
}));

// `deposit_paid` sits between `on_hold` and `confirmed`: the deposit has been
// received (dates stay blocked) but the balance + security deposit are still
// due before arrival. `confirmed` keeps its meaning of "fully paid". See
// ADR-0021. Enum value ordering is cosmetic — every consumer compares by
// string equality, never by ordinal.
export const bookingStatus = pgEnum("booking_status", [
  "requested",
  "on_hold",
  "deposit_paid",
  "confirmed",
  "declined",
  "cancelled",
]);

export const bookingRequest = pgTable("booking_request", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull(),
  guestCount: integer("guest_count").notNull().default(1),
  phone: text("phone"),
  address: text("address").notNull(),
  postalCode: text("postal_code").notNull(),
  city: text("city").notNull(),
  country: text("country").notNull(),
  locale: text("locale").notNull().default("nl"),
  startDate: date("start_date").notNull(),
  endDate: date("end_date").notNull(),
  message: text("message"),
  status: bookingStatus("status").default("requested").notNull(),
  confirmedAt: timestamp("confirmed_at"),
  // The two-stage payment schedule, frozen at confirm time via
  // `computePaymentSchedule` so later settings edits never alter an in-flight
  // booking (same snapshot philosophy as `shownPriceAtBooking`). See ADR-0021.
  //
  // `paymentDeadline` doubles as the deposit deadline (two-stage) or the
  // single deadline (collapsed) — this is the date ADR-0004 lazy expiry
  // reads, so reusing it keeps `isExpiredHold` unchanged.
  // `paymentCollapsed` is the discriminator: NULL until confirm, then true
  // (single payment of 100% + borg) or false (deposit + balance). When true,
  // `depositAmount` holds the single total (100% + borg) due at
  // `paymentDeadline`, and `balanceAmount` / `balanceDeadline` are NULL.
  paymentDeadline: date("payment_deadline"),
  paymentCollapsed: boolean("payment_collapsed"),
  depositAmount: numeric("deposit_amount"),
  balanceAmount: numeric("balance_amount"),
  balanceDeadline: date("balance_deadline"),
  // The borg frozen at confirm time (0 when the owner charges no deposit).
  securityDepositAtBooking: numeric("security_deposit_at_booking"),
  ownerNotes: text("owner_notes"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  shownPriceAtBooking: numeric("shown_price_at_booking").notNull(),
});

export const setting = pgTable("setting", {
  key: text("key").primaryKey(),
  value: text("value").notNull(),
});

export const icalSource = pgTable("ical_source", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  url: text("url").notNull(),
  enabled: boolean("enabled").default(true).notNull(),
  cachedIntervals: jsonb("cached_intervals").$type<BusyInterval[]>(),
  lastSyncedAt: timestamp("last_synced_at"),
  lastError: text("last_error"),
  lastErrorAt: timestamp("last_error_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at")
    .defaultNow()
    .$onUpdate(() => /* @__PURE__ */ new Date())
    .notNull(),
});

export const icalExportToken = pgTable("ical_export_token", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  token: text("token").notNull().unique(),
  lastAccessedAt: timestamp("last_accessed_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export type AltText = {
  nl: string;
  en?: string;
  fr?: string;
  de?: string;
};

export const galleryImage = pgTable("gallery_image", {
  id: text("id").primaryKey(),
  imageUrl: text("image_url").notNull(),
  sortOrder: integer("sort_order").notNull().default(0),
  published: boolean("published").notNull().default(false),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  altText: jsonb("alt_text").$type<AltText>(),
  altTextSource: jsonb("alt_text_source").$type<LocalizedSource>(),
  // Real intrinsic pixel dimensions, captured client-side at upload time
  // (see #103/#104). Nullable: never backfilled for legacy rows in this
  // slice, and a capture failure must never block the upload — the dialog
  // falls back to a fixed 3:2 crop when either is absent.
  width: integer("width"),
  height: integer("height"),
});

export const poi = pgTable("poi", {
  id: text("id").primaryKey(),
  // URL-safe identifier derived from the English translation of the Dutch
  // title, generated once at create and never changed on rename. See ADR-0015.
  slug: text("slug").notNull().unique(),
  title: jsonb("title")
    .$type<{ nl: string; en?: string; fr?: string; de?: string }>()
    .notNull(),
  body: jsonb("body")
    .$type<{ nl: string; en?: string; fr?: string; de?: string }>()
    .notNull(),
  titleSource: jsonb("title_source")
    .$type<{
      nl: "human" | "machine";
      en?: "human" | "machine";
      fr?: "human" | "machine";
      de?: "human" | "machine";
    }>()
    .notNull(),
  bodySource: jsonb("body_source")
    .$type<{
      nl: "human" | "machine";
      en?: "human" | "machine";
      fr?: "human" | "machine";
      de?: "human" | "machine";
    }>()
    .notNull(),
  // Optional rich-text body shown on the POI detail page/modal. Each locale
  // holds a serialized Lexical EditorState; nullable so a POI need not have it.
  detail: jsonb("detail").$type<LocalizedEditorState>(),
  detailSource: jsonb("detail_source").$type<LocalizedSource>(),
  imageUrl: text("image_url").notNull(),
  distanceKm: integer("distance_km"),
  sortOrder: integer("sort_order").notNull().default(0),
  published: boolean("published").notNull().default(false),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export type LocalizedEditorState = {
  nl: SerializedEditorState;
  en?: SerializedEditorState;
  fr?: SerializedEditorState;
  de?: SerializedEditorState;
};

export type LocalizedText = {
  type: "localizedText";
  nl: string;
  en?: string;
  fr?: string;
  de?: string;
};
export type ImageUrl = {
  type: "imageUrl";
  url: string;
};
// Rich-text content_block value (ADR-0017): a "basic prose" subset (bold,
// italic, paragraphs, links — no headings/lists) of the Lexical EditorState
// shape POI detail uses. Distinct `type` tag from `LocalizedText` since a
// content_block row can hold either a plain string or serialized rich text.
export type LocalizedEditorStateValue = {
  type: "localizedEditorState";
} & LocalizedEditorState;
export type ContentBlockValue =
  LocalizedText | ImageUrl | LocalizedEditorStateValue;

export type LocalizedSource = {
  nl: "human" | "machine";
  en?: "human" | "machine";
  fr?: "human" | "machine";
  de?: "human" | "machine";
};

export const contentBlock = pgTable("content_block", {
  key: text("key").primaryKey(),
  value: jsonb("value").$type<ContentBlockValue>().notNull(),
  valueSource: jsonb("value_source").$type<LocalizedSource>(),
  updatedAt: timestamp("updated_at")
    .defaultNow()
    .$onUpdate(() => new Date())
    .notNull(),
});

export const document = pgTable("document", {
  id: text("id").primaryKey(),
  title: text("title").notNull(),
  slug: text("slug").notNull().unique(),
  fileUrl: text("file_url").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at")
    .defaultNow()
    .$onUpdate(() => /* @__PURE__ */ new Date())
    .notNull(),
});

// Owner-managed simple public page (title + one rich-text body), served at
// top-level /{locale}/{slug}. See ADR-0020.
export const page = pgTable("page", {
  id: text("id").primaryKey(),
  // Frozen after create like poi.slug; system pages pin theirs at seed time
  // instead of deriving from the title. See ADR-0020.
  slug: text("slug").notNull().unique(),
  title: jsonb("title")
    .$type<{ nl: string; en?: string; fr?: string; de?: string }>()
    .notNull(),
  titleSource: jsonb("title_source").$type<LocalizedSource>().notNull(),
  body: jsonb("body").$type<LocalizedEditorState>().notNull(),
  bodySource: jsonb("body_source").$type<LocalizedSource>().notNull(),
  published: boolean("published").notNull().default(false),
  // System pages (privacy, terms): editable, undeletable, always published,
  // so hardcoded links (booking form, footer) can never 404.
  system: boolean("system").notNull().default(false),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at")
    .defaultNow()
    .$onUpdate(() => /* @__PURE__ */ new Date())
    .notNull(),
});

export type ReviewSource = "airbnb" | "natuurhuisje" | "direct" | "google";

export const review = pgTable("review", {
  id: text("id").primaryKey(),
  authorName: text("author_name").notNull(),
  rating: integer("rating").notNull(),
  reviewDate: date("review_date").notNull(),
  source: text("source").notNull().$type<ReviewSource>(),
  // Source of truth: the guest's verbatim words and the language they wrote in.
  // `originalLocale` is a BCP-47 code (one of the four display locales, a wider
  // language like "it", or the sentinel "und" until auto-detected). See ADR-0014.
  originalLocale: text("original_locale").notNull(),
  originalBody: text("original_body").notNull(),
  // Derived projection over the four display locales. Every key is optional:
  // a foreign-original review may have no human slot, and translations are
  // filled lazily (lenient publish). Resolve reads via resolveReviewBody().
  body: jsonb("body")
    .$type<{ nl?: string; en?: string; fr?: string; de?: string }>()
    .notNull(),
  bodySource: jsonb("body_source")
    .$type<{
      nl?: "human" | "machine";
      en?: "human" | "machine";
      fr?: "human" | "machine";
      de?: "human" | "machine";
    }>()
    .notNull(),
  published: boolean("published").notNull().default(false),
  sortOrder: integer("sort_order").notNull().default(0),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});
