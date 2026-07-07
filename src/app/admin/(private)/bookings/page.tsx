import { verifySession } from "@/lib/auth/session";
import { getDb } from "@/db";
import { bookingRequest } from "@/db/schema";
import { desc } from "drizzle-orm";
import {
  getSettings,
  hasBankDetails,
  paymentScheduleSettings,
  securityDepositAmount,
} from "@/lib/settings/settings";
import {
  toDisplayStatus,
  type DisplayStatus,
  type DbBookingStatus,
} from "@/lib/booking/machine";
import {
  computePaymentSchedule,
  bookingPaymentSchedule,
} from "@/lib/booking/payment-schedule";
import { toUtcDayString } from "@/lib/booking/calendar-day";
import { BookingActions } from "./booking-actions";
import { NotesEditor } from "./notes-editor";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { TriangleAlert } from "lucide-react";
import {
  calculatePriceBreakdown,
  calculateTotalNights,
} from "@/app/[locale]/book/shared";
import { getCountryName } from "@/lib/countries";

const STATUS_LABELS: Record<DisplayStatus, string> = {
  requested: "Aangevraagd",
  on_hold: "In afwachting",
  deposit_paid: "Aanbetaling voldaan",
  confirmed: "Bevestigd",
  declined: "Afgewezen",
  cancelled: "Geannuleerd",
  expired: "Verlopen",
};

const STATUS_COLORS: Record<DisplayStatus, string> = {
  requested: "bg-blue-100 text-blue-800",
  on_hold: "bg-yellow-100 text-yellow-800",
  deposit_paid: "bg-teal-100 text-teal-800",
  confirmed: "bg-green-100 text-green-800",
  declined: "bg-stone-100 text-stone-500",
  cancelled: "bg-red-100 text-red-700",
  expired: "bg-orange-100 text-orange-700",
};

const ALL_STATUSES: DisplayStatus[] = [
  "requested",
  "on_hold",
  "deposit_paid",
  "expired",
  "confirmed",
  "declined",
  "cancelled",
];

const eur = new Intl.NumberFormat("nl-NL", {
  style: "currency",
  currency: "EUR",
});

type PageProps = {
  searchParams: Promise<{ status?: string }>;
};

export default async function BookingsPage({ searchParams }: PageProps) {
  await verifySession();

  const { status: filterStatus } = await searchParams;

  const [db, settings] = await Promise.all([
    Promise.resolve(getDb()),
    getSettings(),
  ]);

  const rows = await db
    .select()
    .from(bookingRequest)
    .orderBy(desc(bookingRequest.createdAt));

  const bookings = rows.map((r) => ({
    ...r,
    displayStatus: toDisplayStatus({
      status: r.status as DbBookingStatus,
      paymentDeadline: r.paymentDeadline,
    }),
  }));

  const filtered =
    filterStatus && ALL_STATUSES.includes(filterStatus as DisplayStatus)
      ? bookings.filter((b) => b.displayStatus === filterStatus)
      : bookings;

  const bankDetailsOk = hasBankDetails(settings);
  const scheduleSettings = paymentScheduleSettings(settings);
  const borg = securityDepositAmount(settings);
  const today = toUtcDayString();

  return (
    <main className="min-h-screen p-8">
      <div className="max-w-5xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-semibold">Boekingen</h1>
        </div>

        {/* Status filter */}
        <div className="flex gap-2 flex-wrap">
          <Link
            href="/admin/bookings"
            className={cn(
              "rounded-full px-3 py-1 text-xs font-medium",
              !filterStatus
                ? "bg-stone-800 text-white"
                : "bg-stone-100 text-stone-600 hover:bg-stone-200",
            )}
          >
            Alle
          </Link>
          {ALL_STATUSES.map((s) => (
            <Link
              key={s}
              href={`/admin/bookings?status=${s}`}
              className={cn(
                "rounded-full px-3 py-1 text-xs font-medium",
                filterStatus === s
                  ? "bg-stone-800 text-white"
                  : "bg-stone-100 text-stone-600 hover:bg-stone-200",
              )}
            >
              {STATUS_LABELS[s]}
            </Link>
          ))}
        </div>

        {!bankDetailsOk && (
          <Alert variant="warning">
            <TriangleAlert className="size-4" />
            <AlertTitle>Bankgegevens niet ingesteld</AlertTitle>
            <AlertDescription>
              Stel uw bankgegevens in via de{" "}
              <Link
                href="/admin/settings"
                className="underline hover:text-stone-600"
              >
                instellingen
              </Link>{" "}
              om boekingen te bevestigen en uitbetalingen te ontvangen.
            </AlertDescription>
          </Alert>
        )}
        {filtered.length === 0 ? (
          <p className="text-stone-400 text-sm">Geen boekingen gevonden.</p>
        ) : (
          <div className="space-y-4">
            {filtered.map((booking) => {
              const nights = calculateTotalNights(
                booking.startDate,
                booking.endDate,
              );
              const { discount, totalPrice } = calculatePriceBreakdown(
                Number(booking.shownPriceAtBooking),
                nights,
                booking.guestCount,
              );
              // Preview shown in the confirm dialog (requested bookings). The
              // action re-derives the schedule at confirm time; this is
              // informational. For already-confirmed bookings the frozen
              // snapshot below is what actually applies.
              const schedulePreview = {
                schedule: computePaymentSchedule(
                  totalPrice,
                  borg,
                  today,
                  booking.startDate,
                  scheduleSettings,
                ),
                securityDeposit: borg,
              };
              const frozenSchedule = bookingPaymentSchedule(booking);
              return (
                <div
                  key={booking.id}
                  id={`booking-${booking.id}`}
                  className="rounded-lg border border-stone-200 bg-white p-5 space-y-4 scroll-mt-8 target:border-stone-400"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{booking.name}</span>
                        <span
                          className={cn(
                            "rounded-full px-2 py-0.5 text-xs font-medium",
                            STATUS_COLORS[booking.displayStatus],
                          )}
                        >
                          {STATUS_LABELS[booking.displayStatus]}
                        </span>
                      </div>
                      <p className="text-sm text-stone-500">
                        {booking.email}
                        {booking.phone ? ` · ${booking.phone}` : ""}
                      </p>
                      <div className="text-sm text-stone-500">
                        <p>{booking.address}</p>
                        <p>
                          {booking.postalCode} {booking.city}
                        </p>
                        <p>{getCountryName(booking.country, "nl")}</p>
                      </div>
                      <p className="text-sm text-stone-500">
                        Prijs per nacht bij boeking: €
                        {booking.shownPriceAtBooking}
                      </p>
                      {discount > 0 && (
                        <p className="text-sm text-stone-500">
                          10% korting (7+ nachten): −€{discount.toFixed(2)}
                        </p>
                      )}
                      <p className="text-sm text-stone-500">
                        Totaalprijs bij boeking: €{totalPrice.toFixed(2)}
                      </p>
                    </div>
                    <div className="text-right text-sm text-stone-500 shrink-0">
                      <p>
                        {booking.startDate} → {booking.endDate}
                      </p>
                      <p>
                        {booking.guestCount} gast
                        {booking.guestCount !== 1 ? "en" : ""}
                      </p>
                      {booking.paymentDeadline &&
                        (booking.displayStatus === "on_hold" ||
                          booking.displayStatus === "expired") && (
                          <p className="text-orange-600">
                            Vervaldatum: {booking.paymentDeadline}
                          </p>
                        )}
                    </div>
                  </div>

                  {frozenSchedule && (
                    <div className="rounded bg-stone-50 p-3 text-sm text-stone-600 space-y-1">
                      <p className="text-xs font-medium text-stone-400 uppercase tracking-wide">
                        Betalingsschema
                      </p>
                      {frozenSchedule.collapsed ? (
                        <p>
                          Volledige betaling:{" "}
                          {eur.format(frozenSchedule.totalAmount)} — vóór{" "}
                          {frozenSchedule.deadline}
                        </p>
                      ) : (
                        <>
                          <p>
                            Aanbetaling:{" "}
                            {eur.format(frozenSchedule.depositAmount)} — vóór{" "}
                            {frozenSchedule.depositDeadline}
                            {(booking.displayStatus === "deposit_paid" ||
                              booking.displayStatus === "confirmed") &&
                              " ✓ voldaan"}
                          </p>
                          <p>
                            Restbetaling:{" "}
                            {eur.format(frozenSchedule.balanceAmount)} — vóór{" "}
                            {frozenSchedule.balanceDeadline}
                            {booking.displayStatus === "confirmed" &&
                              " ✓ voldaan"}
                          </p>
                        </>
                      )}
                      {booking.securityDepositAtBooking != null &&
                        Number(booking.securityDepositAtBooking) > 0 && (
                          <p className="text-xs text-stone-400">
                            Incl. borg{" "}
                            {eur.format(
                              Number(booking.securityDepositAtBooking),
                            )}
                          </p>
                        )}
                    </div>
                  )}

                  {booking.message && (
                    <p className="text-sm text-stone-600 bg-stone-50 rounded p-3">
                      {booking.message}
                    </p>
                  )}

                  <div className="space-y-1">
                    <p className="text-xs font-medium text-stone-400 uppercase tracking-wide">
                      Eigenaarnotities
                    </p>
                    <NotesEditor
                      bookingId={booking.id}
                      initialNotes={booking.ownerNotes}
                    />
                  </div>

                  <div className="flex items-center justify-between">
                    <p className="text-xs text-stone-400">
                      {new Date(booking.createdAt).toLocaleDateString("nl-NL", {
                        day: "numeric",
                        month: "short",
                        year: "numeric",
                      })}
                      {" · "}
                      locale: {booking.locale}
                    </p>
                    <BookingActions
                      bookingId={booking.id}
                      guestName={booking.name}
                      displayStatus={booking.displayStatus}
                      bankDetailsConfigured={bankDetailsOk}
                      paymentCollapsed={booking.paymentCollapsed}
                      schedulePreview={schedulePreview}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </main>
  );
}
