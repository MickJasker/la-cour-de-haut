"use server";
import {
  createServerValidate,
  ServerValidateError,
  initialFormState,
} from "@tanstack/react-form-nextjs";
import { getTranslations } from "next-intl/server";
import { createBookingFormSchema } from "./shared";
import { formOpts } from "./shared";
import { getDb } from "@/db";
import { bookingRequest } from "@/db/schema";

const serverValidate = createServerValidate({
  ...formOpts,
  onServerValidate: async ({ value }) => {
    const t = await getTranslations("booking");
    const schema = createBookingFormSchema((key) =>
      t(key as Parameters<typeof t>[0]),
    );
    const result = schema.safeParse(value);
    if (!result.success) {
      return result.error.issues[0]?.message ?? "Validation failed";
    }
  },
});

export type BookingActionState = {
  success: boolean;
  errorMap: { onServer?: unknown };
  values: unknown;
  errors: unknown[];
};

export async function submitBookingAction(
  _prev: unknown,
  formData: FormData,
): Promise<BookingActionState> {
  try {
    const data = await serverValidate(formData);
    const db = getDb();
    await db.insert(bookingRequest).values({
      id: crypto.randomUUID(),
      name: data.name,
      email: data.email,
      phone: data.phone,
      guestCount: parseInt(data.guestCount),
      startDate: data.stayDates.from,
      endDate: data.stayDates.to,
    });
    return { ...initialFormState, success: true };
  } catch (e) {
    if (e instanceof ServerValidateError) {
      return { ...e.formState, success: false };
    }
    throw e;
  }
}

export async function getBookedDatesAction(): Promise<string[]> {
  const db = getDb();
  const bookings = await db.query.bookingRequest.findMany({
    where: (bookingRequest, { eq, or }) =>
      or(
        eq(bookingRequest.status, "pending"),
        eq(bookingRequest.status, "confirmed"),
      ),
  });

  // TODO: merge data from ical feed if available

  return bookings.flatMap((booking) => {
    const start = new Date(booking.startDate + "T00:00:00");
    const end = new Date(booking.endDate + "T00:00:00");
    const dates: string[] = [];
    for (let date = start; date < end; date.setDate(date.getDate() + 1)) {
      dates.push(
        `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`,
      );
    }
    return dates;
  });
}
