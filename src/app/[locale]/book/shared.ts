import { formOptions } from "@tanstack/react-form-nextjs";
import { z } from "zod";

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
  },
});
export function createBookingFormSchema(t: (key: string) => string) {
  return z.object({
    name: z.string().min(2, t("fieldErrors.required")),
    email: z.email(t("fieldErrors.email")),
    phone: z.string(),
    guestCount: z.union([z.literal("1"), z.literal("2")]),
    stayDates: z
      .object({
        from: z.string(),
        to: z.string(),
      })
      .refine(
        ({ from, to }) => {
          const fromDate = new Date(from);
          const toDate = new Date(to);

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
            new Date(to).getTime() - new Date(from).getTime() >=
            1000 * 60 * 60 * 24
          );
        },
        {
          message: t("fieldErrors.minNights"),
        },
      ),
  });
}
