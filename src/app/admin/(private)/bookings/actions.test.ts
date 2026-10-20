import { describe, it, expect, vi, beforeEach } from "vitest";
import type { Mock } from "vitest";

vi.mock("next/cache", () => ({ revalidatePath: vi.fn(), updateTag: vi.fn() }));
vi.mock("drizzle-orm", () => ({ eq: vi.fn() }));
vi.mock("@/db", () => ({ getDb: vi.fn() }));
vi.mock("@/db/schema", () => ({ bookingRequest: {} }));
vi.mock("@/lib/auth/session", () => ({ verifySession: vi.fn() }));
vi.mock("@/lib/booking/lifecycle", () => ({
  applyTransition: vi.fn(),
  LatePaymentDatesTakenError: class LatePaymentDatesTakenError extends Error {},
}));

import { revalidatePath, updateTag } from "next/cache";
import {
  applyTransition,
  LatePaymentDatesTakenError,
} from "@/lib/booking/lifecycle";
import { markDepositPaidBookingAction, markPaidBookingAction } from "./actions";

beforeEach(() => {
  vi.clearAllMocks();
});

describe.each([
  ["markPaidBookingAction", markPaidBookingAction, "mark_paid"],
  [
    "markDepositPaidBookingAction",
    markDepositPaidBookingAction,
    "mark_deposit_paid",
  ],
] as const)("%s", (_name, run, transitionAction) => {
  it("applies the transition, invalidates caches and returns ok", async () => {
    (applyTransition as Mock).mockResolvedValue(undefined);

    await expect(run("bk-1")).resolves.toEqual({ ok: true });

    expect(applyTransition).toHaveBeenCalledWith("bk-1", transitionAction);
    expect(revalidatePath).toHaveBeenCalledWith("/admin/bookings");
    expect(updateTag).toHaveBeenCalledOnce();
  });

  it("maps a late-payment date conflict to a Dutch error result and invalidates nothing", async () => {
    (applyTransition as Mock).mockRejectedValue(
      new LatePaymentDatesTakenError(),
    );

    await expect(run("bk-1")).resolves.toEqual({
      ok: false,
      error: expect.stringContaining("datums zijn inmiddels bezet"),
    });

    expect(revalidatePath).not.toHaveBeenCalled();
    expect(updateTag).not.toHaveBeenCalled();
  });

  it("rethrows any other error instead of swallowing it", async () => {
    (applyTransition as Mock).mockRejectedValue(new Error("db down"));

    await expect(run("bk-1")).rejects.toThrow("db down");
    expect(revalidatePath).not.toHaveBeenCalled();
  });
});
