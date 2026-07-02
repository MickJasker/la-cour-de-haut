import { describe, it, expect, vi, beforeEach } from "vitest";
import type { Mock } from "vitest";

// No mocking of @/db, drizzle-orm, or sibling modules: the availability
// module takes its DB store, feed fetch, and clock as injected
// `AvailabilityDeps` (see ./availability-store.ts), so tests substitute an
// in-memory store + a scripted fetch + a fixed clock at that seam instead.
// `next/server`'s `connection()` is the one exception — it's a Next.js
// request-scope primitive that throws outside an actual request/render and
// isn't part of this module's own seam, so it's stubbed like any other
// framework API a unit test can't satisfy.
vi.mock("next/server", () => ({
  connection: vi.fn().mockResolvedValue(undefined),
}));

import {
  expandInterval,
  hasConflict,
  isActiveDirectBooking,
} from "./availability-utils";
import type { BusyInterval } from "@/db/schema";
import type {
  AvailabilityStore,
  IcalSourceRow,
  DirectBookingRow,
} from "./availability-store";
import type { AvailabilityDeps, FetchFeed } from "./availability";
import {
  isRangeAvailable,
  getBookedDays,
  getBusyIntervals,
} from "./availability";

function expandIntervals(intervals: BusyInterval[]): string[] {
  return [...new Set(intervals.flatMap(expandInterval))].sort();
}

describe("hasConflict", () => {
  it("returns false for an empty interval list", () => {
    expect(hasConflict([], "2025-08-01", "2025-08-07")).toBe(false);
  });

  it("returns false when the booking range does not overlap any interval", () => {
    const intervals = [{ start: "2025-08-01", end: "2025-08-07" }];
    expect(hasConflict(intervals, "2025-08-10", "2025-08-14")).toBe(false);
  });

  it("returns false when booking checkout equals interval start (DTEND exclusive)", () => {
    const intervals = [{ start: "2025-08-10", end: "2025-08-17" }];
    // booking checks out on 2025-08-10 — same day a new block starts
    expect(hasConflict(intervals, "2025-08-05", "2025-08-10")).toBe(false);
  });

  it("returns false when booking start equals interval end (DTEND exclusive)", () => {
    const intervals = [{ start: "2025-08-01", end: "2025-08-08" }];
    // previous block ends on 2025-08-08 — booking starts that same day
    expect(hasConflict(intervals, "2025-08-08", "2025-08-15")).toBe(false);
  });

  it("returns true when booking partially overlaps an interval from the left", () => {
    const intervals = [{ start: "2025-08-05", end: "2025-08-12" }];
    expect(hasConflict(intervals, "2025-08-01", "2025-08-07")).toBe(true);
  });

  it("returns true when booking partially overlaps an interval from the right", () => {
    const intervals = [{ start: "2025-08-01", end: "2025-08-08" }];
    expect(hasConflict(intervals, "2025-08-05", "2025-08-12")).toBe(true);
  });

  it("returns true when booking is fully contained within an interval", () => {
    const intervals = [{ start: "2025-08-01", end: "2025-08-31" }];
    expect(hasConflict(intervals, "2025-08-10", "2025-08-17")).toBe(true);
  });

  it("returns true when booking fully contains an interval", () => {
    const intervals = [{ start: "2025-08-05", end: "2025-08-10" }];
    expect(hasConflict(intervals, "2025-08-01", "2025-08-15")).toBe(true);
  });

  it("returns true when booking matches interval exactly", () => {
    const intervals = [{ start: "2025-08-01", end: "2025-08-08" }];
    expect(hasConflict(intervals, "2025-08-01", "2025-08-08")).toBe(true);
  });

  it("returns true when any one of multiple intervals conflicts", () => {
    const intervals = [
      { start: "2025-07-01", end: "2025-07-07" },
      { start: "2025-08-10", end: "2025-08-17" },
    ];
    expect(hasConflict(intervals, "2025-08-12", "2025-08-20")).toBe(true);
  });
});

describe("expandInterval", () => {
  it("expands a single-night interval to one date", () => {
    expect(
      expandIntervals([{ start: "2025-07-10", end: "2025-07-11" }]),
    ).toEqual(["2025-07-10"]);
  });

  it("treats DTEND as exclusive — checkout day is not blocked", () => {
    const dates = expandIntervals([{ start: "2025-07-10", end: "2025-07-13" }]);
    expect(dates).toEqual(["2025-07-10", "2025-07-11", "2025-07-12"]);
    expect(dates).not.toContain("2025-07-13");
  });

  it("merges overlapping intervals without duplicates", () => {
    const dates = expandIntervals([
      { start: "2025-08-01", end: "2025-08-05" },
      { start: "2025-08-03", end: "2025-08-07" },
    ]);
    expect(dates).toEqual([
      "2025-08-01",
      "2025-08-02",
      "2025-08-03",
      "2025-08-04",
      "2025-08-05",
      "2025-08-06",
    ]);
  });

  it("merges disjoint intervals from multiple sources", () => {
    const dates = expandIntervals([
      { start: "2025-06-01", end: "2025-06-03" },
      { start: "2025-06-10", end: "2025-06-12" },
    ]);
    expect(dates).toEqual([
      "2025-06-01",
      "2025-06-02",
      "2025-06-10",
      "2025-06-11",
    ]);
  });

  it("returns empty array for empty input", () => {
    expect(expandIntervals([])).toEqual([]);
  });

  it("handles a zero-duration interval (start === end) gracefully", () => {
    expect(
      expandIntervals([{ start: "2025-07-10", end: "2025-07-10" }]),
    ).toEqual([]);
  });
});

describe("isActiveDirectBooking — busy-intervals consumes the shared isExpiredHold predicate", () => {
  const TODAY = "2026-06-30";
  const YESTERDAY = "2026-06-29";

  it("a confirmed booking always counts as active, regardless of deadline", () => {
    expect(
      isActiveDirectBooking(
        { status: "confirmed", paymentDeadline: YESTERDAY },
        TODAY,
      ),
    ).toBe(true);
  });

  it("an on_hold booking with deadline yesterday is no longer active (expired)", () => {
    expect(
      isActiveDirectBooking(
        { status: "on_hold", paymentDeadline: YESTERDAY },
        TODAY,
      ),
    ).toBe(false);
  });

  it("an on_hold booking with deadline exactly today is still active (boundary)", () => {
    expect(
      isActiveDirectBooking(
        { status: "on_hold", paymentDeadline: TODAY },
        TODAY,
      ),
    ).toBe(true);
  });

  it("an on_hold booking with no deadline yet is still active", () => {
    expect(
      isActiveDirectBooking(
        { status: "on_hold", paymentDeadline: null },
        TODAY,
      ),
    ).toBe(true);
  });

  it("a requested booking never counts as active (doesn't block dates yet)", () => {
    expect(
      isActiveDirectBooking(
        { status: "requested", paymentDeadline: null },
        TODAY,
      ),
    ).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Fakes for the injected AvailabilityDeps seam (store / fetchFeed / clock).
// These are plain in-memory implementations of AvailabilityStore — no
// vi.mock of @/db, drizzle-orm, or ./availability-store involved.
// ---------------------------------------------------------------------------

type SyncSuccessCall = {
  id: string;
  intervals: BusyInterval[];
  syncedAt: Date;
};
type SyncErrorCall = { id: string; error: string; erroredAt: Date };

function createFakeStore(opts: {
  sources?: IcalSourceRow[];
  bookings?: DirectBookingRow[];
}): AvailabilityStore & {
  syncSuccessCalls: SyncSuccessCall[];
  syncErrorCalls: SyncErrorCall[];
} {
  const sources = opts.sources ?? [];
  const bookings = opts.bookings ?? [];
  const syncSuccessCalls: SyncSuccessCall[] = [];
  const syncErrorCalls: SyncErrorCall[] = [];

  return {
    syncSuccessCalls,
    syncErrorCalls,
    async listEnabledIcalSources() {
      return sources;
    },
    async recordIcalSyncSuccess(id, intervals, syncedAt) {
      syncSuccessCalls.push({ id, intervals, syncedAt });
      const source = sources.find((s) => s.id === id);
      if (source) {
        source.cachedIntervals = intervals;
        source.lastSyncedAt = syncedAt;
      }
    },
    async recordIcalSyncError(id, error, erroredAt) {
      syncErrorCalls.push({ id, error, erroredAt });
    },
    async listDirectBookings() {
      return bookings;
    },
  };
}

function fixedClock(now: Date): () => Date {
  return () => now;
}

function makeDeps(opts: {
  sources?: IcalSourceRow[];
  bookings?: DirectBookingRow[];
  fetchFeed?: FetchFeed;
  now?: Date;
}): AvailabilityDeps & {
  store: ReturnType<typeof createFakeStore>;
  fetchFeed: Mock;
} {
  const now = opts.now ?? new Date("2027-01-01T00:00:00.000Z");
  const store = createFakeStore({
    sources: opts.sources,
    bookings: opts.bookings,
  });
  const fetchFeed = vi.fn(
    opts.fetchFeed ??
      (async () => ({ ok: true as const, intervals: [] as BusyInterval[] })),
  );
  return { store, fetchFeed, clock: fixedClock(now) };
}

describe("isRangeAvailable / getBookedDays / getBusyIntervals — the public availability interface", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("a range with no busy intervals is available", async () => {
    const deps = makeDeps({});
    await expect(
      isRangeAvailable("2027-01-01", "2027-01-05", deps),
    ).resolves.toBe(true);
  });

  it("a range overlapping an active on_hold booking is unavailable", async () => {
    const deps = makeDeps({
      bookings: [
        {
          id: "b1",
          startDate: "2027-01-01",
          endDate: "2027-01-05",
          status: "on_hold",
          paymentDeadline: "2099-01-01",
        },
      ],
    });
    await expect(
      isRangeAvailable("2027-01-02", "2027-01-03", deps),
    ).resolves.toBe(false);
  });

  it("a range overlapping a freshly-fetched iCal-sourced busy interval is unavailable", async () => {
    const deps = makeDeps({
      sources: [
        {
          id: "s1",
          url: "https://example.com/s1.ics",
          cachedIntervals: null,
          lastSyncedAt: null,
        },
      ],
      fetchFeed: async () => ({
        ok: true,
        intervals: [{ start: "2027-04-01", end: "2027-04-05" }],
      }),
    });
    await expect(
      isRangeAvailable("2027-04-02", "2027-04-03", deps),
    ).resolves.toBe(false);
  });

  it("an expired hold frees its dates — the range becomes available again", async () => {
    const deps = makeDeps({
      bookings: [
        {
          id: "b1",
          startDate: "2027-01-01",
          endDate: "2027-01-05",
          status: "on_hold",
          paymentDeadline: "2000-01-01", // long past
        },
      ],
    });
    await expect(
      isRangeAvailable("2027-01-02", "2027-01-03", deps),
    ).resolves.toBe(true);
  });

  it("getBookedDays expands and dedupes busy intervals from bookings and iCal sources", async () => {
    const deps = makeDeps({
      bookings: [
        {
          id: "b1",
          startDate: "2027-02-01",
          endDate: "2027-02-03",
          status: "confirmed",
          paymentDeadline: null,
        },
      ],
      sources: [
        {
          id: "s1",
          url: "https://example.com/s1.ics",
          cachedIntervals: null,
          lastSyncedAt: null,
        },
      ],
      fetchFeed: async () => ({
        ok: true,
        intervals: [{ start: "2027-02-02", end: "2027-02-04" }],
      }),
    });
    const days = await getBookedDays(deps);
    expect([...days].sort()).toEqual([
      "2027-02-01",
      "2027-02-02",
      "2027-02-03",
    ]);
  });

  it("getBookedDays excludes dates freed by an expired hold", async () => {
    const deps = makeDeps({
      bookings: [
        {
          id: "b1",
          startDate: "2027-03-01",
          endDate: "2027-03-05",
          status: "on_hold",
          paymentDeadline: "2000-01-01",
        },
      ],
    });
    await expect(getBookedDays(deps)).resolves.toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// The lazy-refresh glue (ADR-0005) — previously untested, since the old test
// suite mocked ./ical-cache's refreshSourceIfStale wholesale. These exercise
// the real staleness/write-back/fail-open logic through getBusyIntervals, the
// module's own public interface, substituting only the injected store/fetch/
// clock.
// ---------------------------------------------------------------------------

describe("lazy iCal source refresh (ADR-0005), exercised through getBusyIntervals", () => {
  const NOW = new Date("2027-06-15T12:00:00.000Z");

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("a source synced under 5 minutes ago is not re-fetched; cached intervals are used as-is", async () => {
    const twoMinutesAgo = new Date(NOW.getTime() - 2 * 60 * 1000);
    const deps = makeDeps({
      now: NOW,
      sources: [
        {
          id: "s1",
          url: "https://example.com/s1.ics",
          cachedIntervals: [{ start: "2027-07-01", end: "2027-07-03" }],
          lastSyncedAt: twoMinutesAgo,
        },
      ],
    });

    const intervals = await getBusyIntervals(deps);

    expect(deps.fetchFeed).not.toHaveBeenCalled();
    expect(intervals).toEqual([{ start: "2027-07-01", end: "2027-07-03" }]);
  });

  it("a source synced exactly 5 minutes ago is still fresh (boundary is exclusive)", async () => {
    const exactlyFiveMinutesAgo = new Date(NOW.getTime() - 5 * 60 * 1000);
    const deps = makeDeps({
      now: NOW,
      sources: [
        {
          id: "s1",
          url: "https://example.com/s1.ics",
          cachedIntervals: [{ start: "2027-07-01", end: "2027-07-03" }],
          lastSyncedAt: exactlyFiveMinutesAgo,
        },
      ],
    });

    await getBusyIntervals(deps);

    expect(deps.fetchFeed).not.toHaveBeenCalled();
  });

  it("a source synced more than 5 minutes ago is re-fetched", async () => {
    const sixMinutesAgo = new Date(NOW.getTime() - 6 * 60 * 1000);
    const deps = makeDeps({
      now: NOW,
      sources: [
        {
          id: "s1",
          url: "https://example.com/s1.ics",
          cachedIntervals: [{ start: "2027-07-01", end: "2027-07-03" }],
          lastSyncedAt: sixMinutesAgo,
        },
      ],
      fetchFeed: async () => ({
        ok: true,
        intervals: [{ start: "2027-08-01", end: "2027-08-03" }],
      }),
    });

    const intervals = await getBusyIntervals(deps);

    expect(deps.fetchFeed).toHaveBeenCalledTimes(1);
    expect(deps.fetchFeed).toHaveBeenCalledWith(
      "https://example.com/s1.ics",
      NOW,
    );
    expect(intervals).toEqual([{ start: "2027-08-01", end: "2027-08-03" }]);
  });

  it("a successful refresh writes cachedIntervals + lastSyncedAt back through the store", async () => {
    const staleSince = new Date(NOW.getTime() - 10 * 60 * 1000);
    const deps = makeDeps({
      now: NOW,
      sources: [
        {
          id: "s1",
          url: "https://example.com/s1.ics",
          cachedIntervals: [{ start: "2000-01-01", end: "2000-01-02" }],
          lastSyncedAt: staleSince,
        },
      ],
      fetchFeed: async () => ({
        ok: true,
        intervals: [{ start: "2027-09-01", end: "2027-09-05" }],
      }),
    });

    await getBusyIntervals(deps);

    expect(deps.store.syncSuccessCalls).toEqual([
      {
        id: "s1",
        intervals: [{ start: "2027-09-01", end: "2027-09-05" }],
        syncedAt: NOW,
      },
    ]);
    expect(deps.store.syncErrorCalls).toEqual([]);
  });

  it("a failed refresh writes the error back through the store and retains last-known-good intervals", async () => {
    const staleSince = new Date(NOW.getTime() - 10 * 60 * 1000);
    const deps = makeDeps({
      now: NOW,
      sources: [
        {
          id: "s1",
          url: "https://example.com/s1.ics",
          cachedIntervals: [{ start: "2027-05-01", end: "2027-05-03" }],
          lastSyncedAt: staleSince,
        },
      ],
      fetchFeed: async () => ({ ok: false, error: "HTTP 500" }),
    });

    const intervals = await getBusyIntervals(deps);

    // Last-known-good intervals are still returned despite the failed fetch.
    expect(intervals).toEqual([{ start: "2027-05-01", end: "2027-05-03" }]);
    expect(deps.store.syncErrorCalls).toEqual([
      { id: "s1", error: "HTTP 500", erroredAt: NOW },
    ]);
    expect(deps.store.syncSuccessCalls).toEqual([]);
  });

  it("a never-synced source that fails to fetch fails open — contributes no busy intervals", async () => {
    const deps = makeDeps({
      now: NOW,
      sources: [
        {
          id: "s1",
          url: "https://example.com/s1.ics",
          cachedIntervals: null,
          lastSyncedAt: null,
        },
      ],
      fetchFeed: async () => ({ ok: false, error: "ENOTFOUND" }),
    });

    const intervals = await getBusyIntervals(deps);

    expect(intervals).toEqual([]);
    expect(deps.store.syncErrorCalls).toEqual([
      { id: "s1", error: "ENOTFOUND", erroredAt: NOW },
    ]);
    // Fail-open means a range in this window is still reported available.
    await expect(
      isRangeAvailable("2027-06-20", "2027-06-25", deps),
    ).resolves.toBe(true);
  });

  it("a never-synced source is always stale and is fetched on first read", async () => {
    const deps = makeDeps({
      now: NOW,
      sources: [
        {
          id: "s1",
          url: "https://example.com/s1.ics",
          cachedIntervals: null,
          lastSyncedAt: null,
        },
      ],
      fetchFeed: async () => ({
        ok: true,
        intervals: [{ start: "2027-06-01", end: "2027-06-02" }],
      }),
    });

    await getBusyIntervals(deps);

    expect(deps.fetchFeed).toHaveBeenCalledTimes(1);
  });

  it("feed sync health is written exactly once per real fetch, never on a cache hit", async () => {
    const twoMinutesAgo = new Date(NOW.getTime() - 2 * 60 * 1000);
    const deps = makeDeps({
      now: NOW,
      sources: [
        {
          id: "s1",
          url: "https://example.com/s1.ics",
          cachedIntervals: [{ start: "2027-07-01", end: "2027-07-03" }],
          lastSyncedAt: twoMinutesAgo,
        },
      ],
    });

    await getBusyIntervals(deps);
    await getBusyIntervals(deps);

    expect(deps.fetchFeed).not.toHaveBeenCalled();
    expect(deps.store.syncSuccessCalls).toEqual([]);
    expect(deps.store.syncErrorCalls).toEqual([]);
  });
});
