import { describe, it, expect } from "vitest";
import {
  calculateDiscount,
  calculateTotalNights,
  calculateTourismTax,
  calculatePriceBreakdown,
  createBookingFormSchema,
} from "./shared";

// Identity translator: error messages come back as their i18n keys, so a test
// can assert exactly which field failed without depending on copy.
const t = (key: string) => key;

const isoInDays = (days: number) => {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
};

const validBooking = {
  name: "Test Guest",
  email: "guest@example.com",
  phone: "+33612345678",
  guestCount: "2" as const,
  stayDates: { from: isoInDays(10), to: isoInDays(14) },
  address: "1 Rue de Test",
  postalCode: "14000",
  city: "Caen",
  country: "FR",
};

describe("createBookingFormSchema — phone", () => {
  const schema = createBookingFormSchema(t);

  it("accepts a valid E.164 phone number", () => {
    expect(schema.safeParse(validBooking).success).toBe(true);
  });

  it("rejects an empty phone number (now required)", () => {
    const result = schema.safeParse({ ...validBooking, phone: "" });
    expect(result.success).toBe(false);
    const phoneIssue = result.error?.issues.find((i) => i.path[0] === "phone");
    expect(phoneIssue?.message).toBe("fieldErrors.phone");
  });

  it("rejects a malformed phone number", () => {
    const result = schema.safeParse({ ...validBooking, phone: "+33123" });
    expect(result.success).toBe(false);
    const phoneIssue = result.error?.issues.find((i) => i.path[0] === "phone");
    expect(phoneIssue?.message).toBe("fieldErrors.phone");
  });
});

describe("calculateTotalNights", () => {
  it("returns 1 for consecutive days", () => {
    expect(calculateTotalNights("2025-07-01", "2025-07-02")).toBe(1);
  });

  it("returns 7 for a week", () => {
    expect(calculateTotalNights("2025-07-01", "2025-07-08")).toBe(7);
  });

  it("handles month boundaries", () => {
    expect(calculateTotalNights("2025-01-29", "2025-02-02")).toBe(4);
  });
});

describe("calculateDiscount", () => {
  it("returns 0 for stays under 7 nights", () => {
    expect(calculateDiscount(6, 900)).toBe(0);
  });

  it("returns 10% for exactly 7 nights", () => {
    expect(calculateDiscount(7, 1050)).toBeCloseTo(105);
  });

  it("returns 10% for stays over 7 nights", () => {
    expect(calculateDiscount(14, 2100)).toBeCloseTo(210);
  });

  it("returns 0 for 0 nights", () => {
    expect(calculateDiscount(0, 0)).toBe(0);
  });
});

describe("calculateTourismTax", () => {
  it("charges 5% of per-person-per-night rate × 1.1 when under cap", () => {
    // €150/night, 2 guests → €75/person/night → 5% = €3.75 (under €4.50 cap)
    // tax = 3.75 × 2 guests × 3 nights × 1.1 = 24.75
    expect(calculateTourismTax(2, 3, 150)).toBeCloseTo(24.75);
  });

  it("caps per-person-per-night tax at €4.50", () => {
    // €400/night, 1 guest → €400/person/night → 5% = €20, capped at €4.50
    // tax = 4.50 × 1 guest × 2 nights × 1.1 = 9.90
    expect(calculateTourismTax(1, 2, 400)).toBeCloseTo(9.9);
  });
});

describe("calculatePriceBreakdown", () => {
  it("returns correct breakdown for a short stay (no discount)", () => {
    // €150/night × 3 nights = €450 rental, no discount
    // tax: €150/2guests = €75/person → 5% = €3.75 → 3.75×2×3×1.1 = 24.75
    const result = calculatePriceBreakdown(150, 3, 2);
    expect(result.rentalSubtotal).toBeCloseTo(450);
    expect(result.discount).toBe(0);
    expect(result.discountedRental).toBeCloseTo(450);
    expect(result.tourismTax).toBeCloseTo(24.75);
    expect(result.totalPrice).toBeCloseTo(474.75);
  });

  it("applies 10% discount for 7+ night stays", () => {
    // €150/night × 7 = €1050 rental, 10% discount = €105
    // discounted rental = €945, discounted per night = €135
    // tax: €135/2 = €67.50/person → 5% = €3.375 → 3.375×2×7×1.1 = 51.975
    const result = calculatePriceBreakdown(150, 7, 2);
    expect(result.rentalSubtotal).toBeCloseTo(1050);
    expect(result.discount).toBeCloseTo(105);
    expect(result.discountedRental).toBeCloseTo(945);
    expect(result.tourismTax).toBeCloseTo(51.975);
    expect(result.totalPrice).toBeCloseTo(996.975);
  });

  it("tourism tax is computed on discounted rate, not original rate", () => {
    const withDiscount = calculatePriceBreakdown(150, 7, 2);
    const withoutDiscount = calculatePriceBreakdown(150, 3, 2);
    // Tax base for discount case is lower than original price
    expect(withDiscount.tourismTax).toBeLessThan(
      calculateTourismTax(2, 7, 150),
    );
    // Sanity: short stay has no discount so its tourismTax uses full rate
    expect(withoutDiscount.tourismTax).toBeCloseTo(
      calculateTourismTax(2, 3, 150),
    );
  });

  it("handles 6 nights with no discount (boundary check)", () => {
    const result = calculatePriceBreakdown(100, 6, 2);
    expect(result.discount).toBe(0);
    expect(result.rentalSubtotal).toBeCloseTo(600);
    expect(result.totalPrice).toBeGreaterThan(600);
  });
});
