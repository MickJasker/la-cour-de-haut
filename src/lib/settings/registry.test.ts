import { describe, it, expect } from "vitest";
import { settingsRegistry } from "./registry";

/**
 * The payment-schedule settings (issue #162). Validation bounds are part of
 * the public contract: percentage 1–100, day counts ≥ 1, borg ≥ 0. Exercised
 * through both the server type (what `getSettings` parses) and the client
 * validation (what the admin form enforces on the raw string).
 */
describe("payment-schedule settings registry entries", () => {
  it("no longer knows payment_deadline_days", () => {
    expect(settingsRegistry).not.toHaveProperty("payment_deadline_days");
  });

  it("deposit_percentage accepts integers 1–100 and rejects out-of-range", () => {
    const { serverType, clientValidation } =
      settingsRegistry.deposit_percentage;
    expect(serverType.parse("50")).toBe(50);
    expect(serverType.parse("1")).toBe(1);
    expect(serverType.parse("100")).toBe(100);
    expect(serverType.safeParse("0").success).toBe(false);
    expect(serverType.safeParse("101").success).toBe(false);
    expect(serverType.safeParse("50.5").success).toBe(false);

    expect(clientValidation.safeParse("50").success).toBe(true);
    expect(clientValidation.safeParse("0").success).toBe(false);
    expect(clientValidation.safeParse("101").success).toBe(false);
    expect(clientValidation.safeParse("").success).toBe(false);
  });

  it("deposit_deadline_days requires a whole day count of at least 1", () => {
    const { serverType, clientValidation } =
      settingsRegistry.deposit_deadline_days;
    expect(serverType.parse("3")).toBe(3);
    expect(serverType.safeParse("0").success).toBe(false);
    expect(serverType.safeParse("-1").success).toBe(false);

    expect(clientValidation.safeParse("3").success).toBe(true);
    expect(clientValidation.safeParse("0").success).toBe(false);
    expect(clientValidation.safeParse("").success).toBe(false);
  });

  it("balance_due_days_before_arrival requires a whole day count of at least 1", () => {
    const { serverType, clientValidation } =
      settingsRegistry.balance_due_days_before_arrival;
    expect(serverType.parse("7")).toBe(7);
    expect(serverType.safeParse("0").success).toBe(false);

    expect(clientValidation.safeParse("7").success).toBe(true);
    expect(clientValidation.safeParse("0").success).toBe(false);
    expect(clientValidation.safeParse("").success).toBe(false);
  });

  it("security_deposit_amount accepts zero and cent amounts, rejects negatives", () => {
    const { serverType, clientValidation } =
      settingsRegistry.security_deposit_amount;
    expect(serverType.parse("0")).toBe(0);
    expect(serverType.parse("200.50")).toBe(200.5);
    expect(serverType.safeParse("-1").success).toBe(false);

    expect(clientValidation.safeParse("0").success).toBe(true);
    expect(clientValidation.safeParse("200.50").success).toBe(true);
    expect(clientValidation.safeParse("-1").success).toBe(false);
    expect(clientValidation.safeParse("").success).toBe(false);
  });
});
