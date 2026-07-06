"use server";
import {
  createServerValidate,
  ServerValidateError,
  initialFormState,
} from "@tanstack/react-form-nextjs";
import { getTranslations } from "@/i18n/server";
import { waitUntil } from "@vercel/functions";
import { Resend } from "resend";
import {
  calculateTotalNights,
  calculateTourismTax,
  createBookingFormSchema,
} from "./shared";
import { formOpts } from "./shared";
import { getDb } from "@/db";
import { bookingRequest } from "@/db/schema";
import { isRangeAvailable, getBookedDays } from "@/lib/booking/availability";
import { defaultLocale, hasLocale } from "@/i18n/routing";
import { getCountryName } from "@/lib/countries";

const serverValidate = createServerValidate({
  ...formOpts,
  onServerValidate: async ({ value }) => {
    // `value` is decoded from the full FormData, so the hidden `_locale` field is
    // present here even though it is not a registered form field.
    const rawLocale = (value as { _locale?: string })._locale;
    const locale = hasLocale(rawLocale) ? rawLocale : defaultLocale;
    const t = await getTranslations({ locale, namespace: "booking" });
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
  formError?: string;
};

async function verifyTurnstile(token: string): Promise<boolean> {
  const secret = process.env.CLOUDFLARE_TURNSTILE_SECRET_KEY;
  if (!secret) return true; // dev bypass when key not configured
  // Cloudflare test secret — always passes; headless browsers can't complete
  // the JS challenge so we skip token validation when using test credentials.
  if (secret === "1x0000000000000000000000000000000AA") return true;
  if (!token) return false;

  try {
    const res = await fetch(
      "https://challenges.cloudflare.com/turnstile/v0/siteverify",
      {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({ secret, response: token }),
      },
    );
    const data = (await res.json()) as { success: boolean };
    return data.success === true;
  } catch {
    return false;
  }
}

const esc = (s: string) =>
  s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

async function sendOwnerNotification(data: {
  name: string;
  email: string;
  phone: string;
  address: string;
  postalCode: string;
  city: string;
  country: string;
  guestCount: string;
  startDate: string;
  endDate: string;
  pricePerNight: number;
}) {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.RESEND_FROM ?? "noreply@lacourdehaut.fr";
  const to = process.env.OWNER_EMAIL;

  if (!apiKey || !to) return; // skip in dev when not configured

  const resend = new Resend(apiKey);

  const currencyFormatter = new Intl.NumberFormat("nl-NL", {
    style: "currency",
    currency: "EUR",
  });

  const totalNights = calculateTotalNights(data.startDate, data.endDate);

  const tourismTax = calculateTourismTax(
    parseInt(data.guestCount),
    totalNights,
    data.pricePerNight,
  );

  const totalPrice = data.pricePerNight * totalNights + tourismTax;

  await resend.emails.send({
    from,
    to,
    replyTo: data.email,
    subject: `Nieuwe boekingsaanvraag van ${data.name.replace(/[\r\n]/g, " ")}`,
    html: `
      <h2>Nieuwe boekingsaanvraag</h2>
      <table cellpadding="6" style="border-collapse:collapse">
        <tr><th align="left">Naam</th><td>${esc(data.name)}</td></tr>
        <tr><th align="left">Email</th><td><a href="mailto:${encodeURIComponent(data.email)}">${esc(data.email)}</a></td></tr>
        <tr><th align="left">Telefoon</th><td>${esc(data.phone) || "—"}</td></tr>
        <tr><th align="left">Adres</th><td>${esc(data.address)}</td></tr>
        <tr><th align="left">Postcode</th><td>${esc(data.postalCode)}</td></tr>
        <tr><th align="left">Woonplaats</th><td>${esc(data.city)}</td></tr>
        <tr><th align="left">Land</th><td>${esc(getCountryName(data.country, "nl"))}</td></tr>
        <tr><th align="left">Gasten</th><td>${esc(data.guestCount)}</td></tr>
        <tr><th align="left">Inchecken</th><td>${esc(data.startDate)}</td></tr>
        <tr><th align="left">Uitchecken</th><td>${esc(data.endDate)}</td></tr>
        <tr><th align="left">Nachten</th><td>${calculateTotalNights(data.startDate, data.endDate)}</td></tr>
        <tr><th align="left">Toeristenbelasting</th><td>${currencyFormatter.format(tourismTax)}</td></tr>
        <tr><th align="left">Totaalprijs</th><td>${currencyFormatter.format(totalPrice)}</td></tr>
      </table>
      <p style="margin-top:24px">
        <a href="${process.env.NEXT_PUBLIC_APP_URL ?? "https://lacourdehaut.fr"}/admin">
          Bekijk in beheeromgeving
        </a>
      </p>
    `,
  });
}

export async function submitBookingAction(
  _prev: unknown,
  formData: FormData,
): Promise<BookingActionState> {
  // 1. Honeypot — silent drop
  if (formData.get("website")) {
    return { ...initialFormState, success: true };
  }

  // Locale comes from the form (hidden `_locale` field), never from request scope.
  const rawLocale = formData.get("_locale");
  const locale =
    typeof rawLocale === "string" && hasLocale(rawLocale)
      ? rawLocale
      : defaultLocale;

  // 2. Turnstile verification
  const token = (formData.get("cf-turnstile-response") as string) ?? "";
  const turnstileOk = await verifyTurnstile(token);
  if (!turnstileOk) {
    const t = await getTranslations({ locale, namespace: "booking" });
    return {
      ...initialFormState,
      success: false,
      formError: t("form.errorMessage"),
    };
  }

  // 3. Field validation + DB insert
  try {
    const data = await serverValidate(formData);

    // 3a. Server-side overlap check — guards against races and crafted POSTs
    const available = await isRangeAvailable(
      data.stayDates.from,
      data.stayDates.to,
    );
    if (!available) {
      const t = await getTranslations({ locale, namespace: "booking" });
      return {
        ...initialFormState,
        success: false,
        formError: t("form.datesUnavailable"),
      };
    }

    const db = getDb();

    const pricePerNight = await getPricePerNightAction();

    await db.insert(bookingRequest).values({
      id: crypto.randomUUID(),
      name: data.name,
      email: data.email,
      phone: data.phone,
      address: data.address,
      postalCode: data.postalCode,
      city: data.city,
      country: data.country,
      guestCount: parseInt(data.guestCount),
      locale,
      startDate: data.stayDates.from,
      endDate: data.stayDates.to,
      shownPriceAtBooking: pricePerNight.toString(),
    });

    // 4. Owner notification — don't block the response on email failure, but
    // keep the function instance alive until the send completes (a dangling
    // promise can be dropped when the serverless instance suspends)
    waitUntil(
      sendOwnerNotification({
        name: data.name,
        email: data.email,
        phone: data.phone,
        address: data.address,
        postalCode: data.postalCode,
        city: data.city,
        country: data.country,
        guestCount: data.guestCount,
        startDate: data.stayDates.from,
        endDate: data.stayDates.to,
        pricePerNight,
      }).catch(console.error),
    );

    return { ...initialFormState, success: true };
  } catch (e) {
    if (e instanceof ServerValidateError) {
      return { ...e.formState, success: false };
    }
    throw e;
  }
}

export async function getBookedDatesAction(): Promise<string[]> {
  return getBookedDays();
}

export async function getPricePerNightAction(): Promise<number> {
  const settings = await import("@/lib/settings/settings");
  const { price_per_night } = await settings.getSettings();
  return price_per_night ?? 0;
}
