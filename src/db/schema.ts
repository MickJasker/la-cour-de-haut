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

export const bookingStatus = pgEnum("booking_status", [
  "requested",
  "on_hold",
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
  locale: text("locale").notNull().default("nl"),
  startDate: date("start_date").notNull(),
  endDate: date("end_date").notNull(),
  message: text("message"),
  status: bookingStatus("status").default("requested").notNull(),
  confirmedAt: timestamp("confirmed_at"),
  paymentDeadline: date("payment_deadline"),
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

export const galleryImage = pgTable("gallery_image", {
  id: text("id").primaryKey(),
  imageUrl: text("image_url").notNull(),
  sortOrder: integer("sort_order").notNull().default(0),
  published: boolean("published").notNull().default(false),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const poi = pgTable("poi", {
  id: text("id").primaryKey(),
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
  imageUrl: text("image_url").notNull(),
  distanceKm: integer("distance_km"),
  sortOrder: integer("sort_order").notNull().default(0),
  published: boolean("published").notNull().default(false),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

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
export type ContentBlockValue = LocalizedText | ImageUrl;

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

export type ReviewSource = "airbnb" | "natuurhuisje" | "direct" | "google";

export const review = pgTable("review", {
  id: text("id").primaryKey(),
  authorName: text("author_name").notNull(),
  rating: integer("rating").notNull(),
  reviewDate: date("review_date").notNull(),
  source: text("source").notNull().$type<ReviewSource>(),
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
