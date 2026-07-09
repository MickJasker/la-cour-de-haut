import "server-only";
import { getDb } from "@/db";
import {
  icalSource,
  bookingRequest,
  ownerBlock,
  type BusyInterval,
} from "@/db/schema";
import { eq, inArray } from "drizzle-orm";

/**
 * The subset of an `ical_source` row the availability module needs to decide
 * whether a source is stale and to render its last-known-good intervals.
 * Typed against the real drizzle select shape (`Pick<...$inferSelect...>`),
 * not a hand-rolled shape, so it can never silently drift from the schema.
 */
export type IcalSourceRow = Pick<
  typeof icalSource.$inferSelect,
  "id" | "url" | "cachedIntervals" | "lastSyncedAt"
>;

/**
 * The subset of a `booking_request` row the availability module needs to
 * decide which direct bookings currently block dates (ADR-0004).
 */
export type DirectBookingRow = Pick<
  typeof bookingRequest.$inferSelect,
  "id" | "startDate" | "endDate" | "status" | "paymentDeadline"
>;

/**
 * The subset of an `owner_block` row the availability module needs. Owner
 * blocks have no lifecycle (they exist or they don't), so unlike a booking
 * there is no status/deadline to carry — just the dates. The private `label`
 * is never read here; it's admin-only and never exported.
 */
export type OwnerBlockRow = Pick<
  typeof ownerBlock.$inferSelect,
  "id" | "startDate" | "endDate"
>;

/**
 * The DB seam behind the availability module — everything it reads or writes
 * to answer "when is a date unavailable?": enabled iCal sources (plus the
 * sync write-back ADR-0005 requires) and live direct-booking holds. This
 * consolidates what used to be split across direct drizzle calls in both
 * `ical-cache.ts` and `availability.ts`.
 *
 * `availability.ts` depends on this interface, not on `@/db`/drizzle-orm
 * directly, so unit tests substitute an in-memory fake here instead of
 * mocking the ORM.
 */
export interface AvailabilityStore {
  listEnabledIcalSources(): Promise<IcalSourceRow[]>;
  recordIcalSyncSuccess(
    id: string,
    intervals: BusyInterval[],
    syncedAt: Date,
  ): Promise<void>;
  recordIcalSyncError(
    id: string,
    error: string,
    erroredAt: Date,
  ): Promise<void>;
  listDirectBookings(): Promise<DirectBookingRow[]>;
  listOwnerBlocks(): Promise<OwnerBlockRow[]>;
}

export const productionAvailabilityStore: AvailabilityStore = {
  async listEnabledIcalSources() {
    const db = getDb();
    return db
      .select({
        id: icalSource.id,
        url: icalSource.url,
        cachedIntervals: icalSource.cachedIntervals,
        lastSyncedAt: icalSource.lastSyncedAt,
      })
      .from(icalSource)
      .where(eq(icalSource.enabled, true));
  },

  async recordIcalSyncSuccess(id, intervals, syncedAt) {
    const db = getDb();
    await db
      .update(icalSource)
      .set({
        cachedIntervals: intervals,
        lastSyncedAt: syncedAt,
        lastError: null,
        lastErrorAt: null,
      })
      .where(eq(icalSource.id, id));
  },

  async recordIcalSyncError(id, error, erroredAt) {
    const db = getDb();
    await db
      .update(icalSource)
      .set({
        lastError: error,
        lastErrorAt: erroredAt,
      })
      .where(eq(icalSource.id, id));
  },

  async listDirectBookings() {
    const db = getDb();
    return db
      .select({
        id: bookingRequest.id,
        startDate: bookingRequest.startDate,
        endDate: bookingRequest.endDate,
        status: bookingRequest.status,
        paymentDeadline: bookingRequest.paymentDeadline,
      })
      .from(bookingRequest)
      .where(
        inArray(bookingRequest.status, [
          "on_hold",
          "deposit_paid",
          "confirmed",
        ]),
      );
  },

  async listOwnerBlocks() {
    const db = getDb();
    // No filtering — blocks have no lifecycle; past blocks are harmless.
    return db
      .select({
        id: ownerBlock.id,
        startDate: ownerBlock.startDate,
        endDate: ownerBlock.endDate,
      })
      .from(ownerBlock);
  },
};
