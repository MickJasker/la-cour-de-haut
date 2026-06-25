import { verifySession } from "@/lib/dal";
import { getDb } from "@/db";
import { bookingRequest } from "@/db/schema";
import { desc } from "drizzle-orm";
import {
  getSettings,
  hasBankDetails,
  paymentDeadlineDays,
} from "@/lib/settings";
import {
  toDisplayStatus,
  type DisplayStatus,
  type DbBookingStatus,
} from "@/lib/booking-machine";
import { BookingActions } from "./booking-actions";
import { NotesEditor } from "./notes-editor";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { TriangleAlert } from "lucide-react";

const STATUS_LABELS: Record<DisplayStatus, string> = {
  requested: "Requested",
  on_hold: "On hold",
  confirmed: "Confirmed",
  declined: "Declined",
  cancelled: "Cancelled",
  expired: "Expired",
};

const STATUS_COLORS: Record<DisplayStatus, string> = {
  requested: "bg-blue-100 text-blue-800",
  on_hold: "bg-yellow-100 text-yellow-800",
  confirmed: "bg-green-100 text-green-800",
  declined: "bg-stone-100 text-stone-500",
  cancelled: "bg-red-100 text-red-700",
  expired: "bg-orange-100 text-orange-700",
};

const ALL_STATUSES: DisplayStatus[] = [
  "requested",
  "on_hold",
  "expired",
  "confirmed",
  "declined",
  "cancelled",
];

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
  const deadlineDays = paymentDeadlineDays(settings);

  return (
    <main className="min-h-screen p-8">
      <div className="max-w-5xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-semibold">Bookings</h1>
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
            All
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
            <AlertTitle>Bank details not configured</AlertTitle>
            <AlertDescription>
              Please set up your bank details in the{" "}
              <Link
                href="/admin/settings"
                className="underline hover:text-stone-600"
              >
                settings
              </Link>{" "}
              to be able to confirm bookings and receive payouts.
            </AlertDescription>
          </Alert>
        )}
        {filtered.length === 0 ? (
          <p className="text-stone-400 text-sm">No bookings found.</p>
        ) : (
          <div className="space-y-4">
            {filtered.map((booking) => (
              <div
                key={booking.id}
                className="rounded-lg border border-stone-200 bg-white p-5 space-y-4"
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
                  </div>
                  <div className="text-right text-sm text-stone-500 shrink-0">
                    <p>
                      {booking.startDate} → {booking.endDate}
                    </p>
                    <p>
                      {booking.guestCount} guest
                      {booking.guestCount !== 1 ? "s" : ""}
                    </p>
                    {booking.paymentDeadline &&
                      (booking.displayStatus === "on_hold" ||
                        booking.displayStatus === "expired") && (
                        <p className="text-orange-600">
                          Due: {booking.paymentDeadline}
                        </p>
                      )}
                  </div>
                </div>

                {booking.message && (
                  <p className="text-sm text-stone-600 bg-stone-50 rounded p-3">
                    {booking.message}
                  </p>
                )}

                <div className="space-y-1">
                  <p className="text-xs font-medium text-stone-400 uppercase tracking-wide">
                    Owner notes
                  </p>
                  <NotesEditor
                    bookingId={booking.id}
                    initialNotes={booking.ownerNotes}
                  />
                </div>

                <div className="flex items-center justify-between">
                  <p className="text-xs text-stone-400">
                    {new Date(booking.createdAt).toLocaleDateString("en-GB", {
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
                    defaultDeadlineDays={deadlineDays}
                    checkInDate={booking.startDate}
                  />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
