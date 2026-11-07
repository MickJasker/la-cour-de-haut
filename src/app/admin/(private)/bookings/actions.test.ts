import { describe, it, expect, vi, beforeEach } from "vitest";
import type { Mock } from "vitest";

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("drizzle-orm", () => ({ eq: vi.fn() }));
vi.mock("@/db", () => ({ getDb: vi.fn() }));
vi.mock("@/db/schema", () => ({ bookingRequest: {} }));
vi.mock("@/lib/auth/session", () => ({ verifySession: vi.fn() }));
vi.mock("@/lib/booking/lifecycle", () => ({ applyTransition: vi.fn() }));

import { revalidatePath } from "next/cache";
import { applyTransition } from "@/lib/booking/lifecycle";
import { getDb } from "@/db";
import {
  cancelBookingAction,
  confirmBookingAction,
  declineBookingAction,
  deleteBookingAction,
  markBalancePaidBookingAction,
  markDepositPaidBookingAction,
  markPaidBookingAction,
} from "./actions";

beforeEach(() => {
  vi.clearAllMocks();
});

describe.each([
  ["confirmBookingAction", confirmBookingAction, "confirm"],
  ["declineBookingAction", declineBookingAction, "decline"],
  ["markPaidBookingAction", markPaidBookingAction, "mark_paid"],
  [
    "markDepositPaidBookingAction",
    markDepositPaidBookingAction,
    "mark_deposit_paid",
  ],
  [
    "markBalancePaidBookingAction",
    markBalancePaidBookingAction,
    "mark_balance_paid",
  ],
  ["cancelBookingAction", cancelBookingAction, "cancel"],
] as const)("%s", (_name, run, transitionAction) => {
  it("applies the transition, refreshes the admin page and returns ok", async () => {
    (applyTransition as Mock).mockResolvedValue({ ok: true });

    await expect(run("bk-1")).resolves.toEqual({ ok: true });

    expect(applyTransition).toHaveBeenCalledWith("bk-1", transitionAction);
    expect(revalidatePath).toHaveBeenCalledWith("/admin/bookings");
  });

  it.each([
    ["dates_taken", "bezet"],
    ["bank_details_missing", "bankgegevens"],
    ["invalid_transition", "niet meer mogelijk"],
  ] as const)(
    "maps a %s refusal to a Dutch error result and refreshes nothing",
    async (reason, fragment) => {
      (applyTransition as Mock).mockResolvedValue({ ok: false, reason });

      await expect(run("bk-1")).resolves.toEqual({
        ok: false,
        error: expect.stringContaining(fragment),
      });
      expect(revalidatePath).not.toHaveBeenCalled();
    },
  );

  it("rethrows any other error instead of swallowing it", async () => {
    (applyTransition as Mock).mockRejectedValue(new Error("db down"));

    await expect(run("bk-1")).rejects.toThrow("db down");
    expect(revalidatePath).not.toHaveBeenCalled();
  });
});

// The real isDeletableBooking runs here (no mock): this proves the action
// itself applies the guard to the DB row rather than trusting the client.
describe("deleteBookingAction", () => {
  function mockDb(row: unknown) {
    const where = vi.fn().mockResolvedValue(undefined);
    const del = vi.fn(() => ({ where }));
    const limit = vi.fn().mockResolvedValue(row ? [row] : []);
    const select = vi.fn(() => ({
      from: () => ({ where: () => ({ limit }) }),
    }));
    (getDb as Mock).mockReturnValue({ select, delete: del });
    return { del };
  }

  it.each([
    ["declined", { status: "declined", paymentDeadline: null }],
    ["cancelled", { status: "cancelled", paymentDeadline: null }],
    ["an expired hold", { status: "on_hold", paymentDeadline: "2000-01-01" }],
  ])("deletes %s and refreshes the admin page", async (_n, row) => {
    const { del } = mockDb(row);

    await expect(deleteBookingAction("bk-1")).resolves.toEqual({ ok: true });
    expect(del).toHaveBeenCalled();
    expect(revalidatePath).toHaveBeenCalledWith("/admin/bookings");
  });

  it.each([
    ["a live hold", { status: "on_hold", paymentDeadline: "2999-01-01" }],
    ["requested", { status: "requested", paymentDeadline: null }],
    ["deposit_paid", { status: "deposit_paid", paymentDeadline: "2000-01-01" }],
    ["confirmed", { status: "confirmed", paymentDeadline: null }],
  ])("refuses %s without deleting", async (_n, row) => {
    const { del } = mockDb(row);

    await expect(deleteBookingAction("bk-1")).resolves.toEqual({
      ok: false,
      error: expect.stringContaining("niet verwijderd"),
    });
    expect(del).not.toHaveBeenCalled();
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it("refuses a missing booking", async () => {
    const { del } = mockDb(null);

    await expect(deleteBookingAction("nope")).resolves.toMatchObject({
      ok: false,
    });
    expect(del).not.toHaveBeenCalled();
  });
});
