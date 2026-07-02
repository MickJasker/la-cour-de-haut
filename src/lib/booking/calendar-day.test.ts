import { describe, it, expect, afterEach } from "vitest";
import { toUtcDayString } from "./calendar-day";

describe("toUtcDayString", () => {
  const originalTz = process.env.TZ;

  afterEach(() => {
    process.env.TZ = originalTz;
  });

  it("uses the UTC day, not a local day that has already rolled forward", () => {
    // UTC+14 — local wall-clock time here is already the next day.
    process.env.TZ = "Pacific/Kiritimati";
    const date = new Date(Date.UTC(2026, 0, 1, 23, 30)); // 2026-01-01T23:30:00Z
    expect(toUtcDayString(date)).toBe("2026-01-01");
  });

  it("uses the UTC day, not a local day that hasn't rolled over yet", () => {
    // UTC-11 — local wall-clock time here is still the previous day.
    process.env.TZ = "Pacific/Midway";
    const date = new Date(Date.UTC(2026, 0, 1, 2, 30)); // 2026-01-01T02:30:00Z
    expect(toUtcDayString(date)).toBe("2026-01-01");
  });

  it("matches the toISOString().slice(0, 10) convention it replaces", () => {
    const date = new Date(Date.UTC(2026, 5, 9, 12, 0));
    expect(toUtcDayString(date)).toBe(date.toISOString().slice(0, 10));
  });

  it("defaults to the current time when no date is given", () => {
    expect(toUtcDayString()).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});
