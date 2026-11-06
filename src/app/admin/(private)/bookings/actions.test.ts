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
import {
  cancelBookingAction,
  confirmBookingAction,
  declineBookingAction,
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
