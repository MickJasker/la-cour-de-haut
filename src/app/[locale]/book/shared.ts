import { formOptions } from "@tanstack/react-form-nextjs";
import { z } from "zod";
import { isValidPhoneNumber } from "libphonenumber-js/min";
import { isValidCountryCode } from "@/lib/countries";
import {
  type PaymentSchedule,
  type PaymentScheduleSettings,
} from "@/lib/booking/payment-schedule";

export const formOpts = formOptions({
  defaultValues: {
    name: "",
    email: "",
    phone: "",
    guestCount: "2" as "1" | "2",
    stayDates: {
      from: "",
      to: "",
    },
    address: "",
    postalCode: "",
    city: "",
    country: "",
  },
});
export function createBookingFormSchema(t: (key: string) => string) {
  return z.object({
    name: z.string().min(2, t("fieldErrors.required")),
    email: z.email(t("fieldErrors.email")),
    // Required + format-validated (ADR-0013, supersedes ADR-0012's optional phone).
    // The value is a composed E.164 string. min(1) gives an empty phone the same
    // "required" message as the other fields; the refine then checks the format.
    phone: z
      .string()
      .min(1, t("fieldErrors.required"))
      .refine(isValidPhoneNumber, t("fieldErrors.phone")),
    guestCount: z.union([z.literal("1"), z.literal("2")]),
    stayDates: z
      .object({
        from: z.string(),
        to: z.string(),
      })
      .refine(
        ({ from, to }) => {
          const fromDate = new Date(from + "T00:00:00");
          const toDate = new Date(to + "T00:00:00");

          // Ensure that the selected dates are not in the past
          const today = new Date();
          today.setHours(0, 0, 0, 0);

          return fromDate < toDate && fromDate >= today && toDate >= today;
        },
        {
          message: t("fieldErrors.dateRange"),
        },
      )
      .refine(
        ({ from, to }) => {
          return (
            new Date(to + "T00:00:00").getTime() -
              new Date(from + "T00:00:00").getTime() >=
            1000 * 60 * 60 * 24
          );
        },
        {
          message: t("fieldErrors.minNights"),
        },
      ),
    address: z
      .string()
      .trim()
      .min(1, t("fieldErrors.required"))
      .max(200, t("fieldErrors.tooLong")),
    postalCode: z
      .string()
      .trim()
      .min(1, t("fieldErrors.required"))
      .max(20, t("fieldErrors.tooLong")),
    city: z
      .string()
      .trim()
      .min(1, t("fieldErrors.required"))
      .max(120, t("fieldErrors.tooLong")),
    country: z
      .string()
      .min(1, t("fieldErrors.required"))
      .refine(isValidCountryCode, t("fieldErrors.required")),
  });
}

const MAX_PER_PERSON_PER_NIGHT = 4.5; // This is a placeholder value. For a real application, you might want to fetch this from a config or database.

export function calculateDiscount(nights: number, rentalTotal: number): number {
  return nights >= 7 ? rentalTotal * 0.1 : 0;
}

export function calculateTourismTax(
  guestCount: number,
  nights: number,
  pricePerNight: number,
): number {
  const pricePerPersonPerNight = pricePerNight / guestCount;
  const taxableAmountPerPersonPerNight = Math.min(
    pricePerPersonPerNight * 0.05,
    MAX_PER_PERSON_PER_NIGHT,
  );
  const subtotalTaxableAmount =
    taxableAmountPerPersonPerNight * guestCount * nights;
  return subtotalTaxableAmount * 1.1;
}

export type PriceBreakdown = {
  rentalSubtotal: number;
  discount: number;
  discountedRental: number;
  tourismTax: number;
  totalPrice: number;
};

export function calculatePriceBreakdown(
  pricePerNight: number,
  nights: number,
  guestCount: number,
): PriceBreakdown {
  const rentalSubtotal = pricePerNight * nights;
  const discount = calculateDiscount(nights, rentalSubtotal);
  const discountedRental = rentalSubtotal - discount;
  const discountedPricePerNight =
    nights > 0 ? discountedRental / nights : pricePerNight;
  const tourismTax = calculateTourismTax(
    guestCount,
    nights,
    discountedPricePerNight,
  );
  return {
    rentalSubtotal,
    discount,
    discountedRental,
    tourismTax,
    totalPrice: discountedRental + tourismTax,
  };
}

export function calculateTotalNights(from: string, to: string): number {
  const fromDate = new Date(from + "T00:00:00");
  const toDate = new Date(to + "T00:00:00");
  return Math.ceil(
    (toDate.getTime() - fromDate.getTime()) / (1000 * 60 * 60 * 24),
  );
}

/**
 * The payment-schedule rows the booking form renders under the price summary,
 * derived from `computePaymentSchedule`'s output (issue #167). Presentation
 * only: it picks WHICH rows to show and carries the values each row's copy
 * interpolates — the component maps a row to a translation key and formats the
 * currency/date per locale. Sharing `computePaymentSchedule` with the
 * confirm-time bank-transfer email guarantees the preview can never contradict
 * what the guest is later asked to pay.
 *
 * `includesBorg` drives label selection: a zero borg would make an
 * "incl. borg" line wrong, so the component swaps to the plain wording.
 */
export type PaymentScheduleRow =
  | {
      kind: "deposit";
      /** EUR. */
      amount: number;
      /** Percentage of the total taken as the deposit. */
      percentage: number;
      /** Days after confirmation the deposit is due. */
      dueWithinDays: number;
    }
  | {
      kind: "balance";
      /** EUR — the remainder of the total plus the borg. */
      amount: number;
      /** UTC day string (YYYY-MM-DD): arrival − dueDaysBeforeArrival. */
      deadline: string;
      /** Days before arrival the balance is due. */
      dueDaysBeforeArrival: number;
      includesBorg: boolean;
    }
  | {
      kind: "total";
      /** EUR — the full total plus the borg, due in one short-notice payment. */
      amount: number;
      includesBorg: boolean;
    };

/**
 * Server-provided inputs for the form's payment-schedule preview: the schedule
 * knobs plus the borg amount, read from settings by
 * `getPaymentScheduleConfigAction`.
 */
export type BookingPaymentConfig = {
  settings: PaymentScheduleSettings;
  securityDeposit: number;
};

export function paymentScheduleRows(
  schedule: PaymentSchedule,
  settings: PaymentScheduleSettings,
  securityDeposit: number,
): PaymentScheduleRow[] {
  const includesBorg = securityDeposit > 0;

  if (schedule.collapsed) {
    return [{ kind: "total", amount: schedule.totalAmount, includesBorg }];
  }

  return [
    {
      kind: "deposit",
      amount: schedule.depositAmount,
      percentage: settings.depositPercentage,
      dueWithinDays: settings.depositDeadlineDays,
    },
    {
      kind: "balance",
      amount: schedule.balanceAmount,
      deadline: schedule.balanceDeadline,
      dueDaysBeforeArrival: settings.balanceDueDaysBeforeArrival,
      includesBorg,
    },
  ];
}
