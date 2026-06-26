import { verifySession } from "@/lib/dal";
import { getDb } from "@/db";
import { bookingRequest, icalSource } from "@/db/schema";
import { notInArray, eq } from "drizzle-orm";
import {
  computeDashboard,
  type BookingRow,
  type IcalSourceRow,
} from "@/lib/dashboard";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  TriangleAlert,
  CheckCircle,
  CalendarDays,
  Clock,
  AlertCircle,
} from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/utils";

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("nl-NL", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function daysUntil(iso: string, today: string): number {
  const ms = new Date(iso).getTime() - new Date(today).getTime();
  return Math.ceil(ms / 86_400_000);
}

type GuestActionType = "requested" | "overdue" | "approaching";

const GUEST_ACTION_CONFIG: Record<
  GuestActionType,
  { label: string; badgeClass: string; description: string; href: string }
> = {
  requested: {
    label: "Nieuw verzoek",
    badgeClass: "bg-blue-100 text-blue-800",
    description: "Wacht op uw reactie",
    href: "/admin/bookings?status=requested",
  },
  overdue: {
    label: "Betaling verlopen",
    badgeClass: "bg-red-100 text-red-700",
    description: "Betalingstermijn verstreken",
    href: "/admin/bookings?status=on_hold",
  },
  approaching: {
    label: "Betaling nadert",
    badgeClass: "bg-orange-100 text-orange-700",
    description: "Betalingstermijn binnen 3 dagen",
    href: "/admin/bookings?status=on_hold",
  },
};

function GuestActionItem({
  booking,
  type,
}: {
  booking: BookingRow;
  type: GuestActionType;
}) {
  const config = GUEST_ACTION_CONFIG[type];
  return (
    <Link
      href={config.href}
      className="block rounded-lg border border-stone-200 bg-white p-4 hover:border-stone-300 hover:bg-stone-50 transition-colors"
    >
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="font-medium text-sm">{booking.name}</span>
            <span
              className={cn(
                "rounded-full px-2 py-0.5 text-xs font-medium",
                config.badgeClass,
              )}
            >
              {config.label}
            </span>
          </div>
          <p className="text-xs text-stone-500">{config.description}</p>
        </div>
        <div className="text-right text-xs text-stone-500 shrink-0">
          <p>
            {formatDate(booking.startDate)} → {formatDate(booking.endDate)}
          </p>
          <p>
            {booking.guestCount} gast{booking.guestCount !== 1 ? "en" : ""}
          </p>
        </div>
      </div>
    </Link>
  );
}

function SystemAlertItem({ source }: { source: IcalSourceRow }) {
  return (
    <Alert variant="warning">
      <TriangleAlert className="size-4" />
      <AlertTitle>iCal synchronisatiefout — {source.name}</AlertTitle>
      <AlertDescription>
        {source.lastError}{" "}
        <Link
          href="/admin/ical/import"
          className="underline hover:text-stone-600"
        >
          Bekijk importinstellingen
        </Link>
      </AlertDescription>
    </Alert>
  );
}

function UpcomingBookingRow({
  booking,
  today,
}: {
  booking: BookingRow;
  today: string;
}) {
  const days = daysUntil(booking.startDate, today);
  return (
    <div className="flex items-center justify-between py-3 border-b border-stone-100 last:border-0">
      <div className="space-y-0.5">
        <p className="text-sm font-medium">{booking.name}</p>
        <p className="text-xs text-stone-500">
          {formatDate(booking.startDate)} → {formatDate(booking.endDate)} ·{" "}
          {booking.guestCount} gast{booking.guestCount !== 1 ? "en" : ""}
        </p>
      </div>
      <span className="text-xs text-stone-400 shrink-0">
        {days === 0 ? "Vandaag" : days === 1 ? "Morgen" : `over ${days} dagen`}
      </span>
    </div>
  );
}

export default async function AdminPage() {
  await verifySession();

  const today = new Date().toISOString().slice(0, 10);
  const db = getDb();

  const [bookings, sources] = await Promise.all([
    db
      .select()
      .from(bookingRequest)
      .where(notInArray(bookingRequest.status, ["declined", "cancelled"])),
    db.select().from(icalSource).where(eq(icalSource.enabled, true)),
  ]);

  const { newRequests, overdue, approaching, brokenFeeds, upcoming } =
    computeDashboard(
      bookings as BookingRow[],
      sources as IcalSourceRow[],
      today,
    );

  const hasGuestActions =
    newRequests.length > 0 || overdue.length > 0 || approaching.length > 0;

  return (
    <main className="min-h-screen p-8">
      <div className="max-w-3xl mx-auto space-y-8">
        <h1 className="text-2xl font-semibold">Beheer</h1>

        {/* Guest actions */}
        {hasGuestActions && (
          <section className="space-y-3">
            <h2 className="text-sm font-medium text-stone-500 uppercase tracking-wide flex items-center gap-2">
              <AlertCircle className="size-3.5" />
              Openstaande acties
            </h2>
            <div className="space-y-2">
              {newRequests.map((b) => (
                <GuestActionItem key={b.id} booking={b} type="requested" />
              ))}
              {overdue.map((b) => (
                <GuestActionItem key={b.id} booking={b} type="overdue" />
              ))}
              {approaching.map((b) => (
                <GuestActionItem key={b.id} booking={b} type="approaching" />
              ))}
            </div>
          </section>
        )}

        {/* System alerts */}
        {brokenFeeds.length > 0 && (
          <section className="space-y-3">
            <h2 className="text-sm font-medium text-stone-500 uppercase tracking-wide flex items-center gap-2">
              <Clock className="size-3.5" />
              Systeemmeldingen
            </h2>
            <div className="space-y-2">
              {brokenFeeds.map((f) => (
                <SystemAlertItem key={f.id} source={f} />
              ))}
            </div>
          </section>
        )}

        {/* Empty state */}
        {!hasGuestActions && brokenFeeds.length === 0 && (
          <div className="flex items-center gap-3 rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800">
            <CheckCircle className="size-4 shrink-0" />
            <span>Alles in orde — geen openstaande acties.</span>
          </div>
        )}

        {/* Upcoming stays */}
        {upcoming.length > 0 && (
          <section className="space-y-3">
            <h2 className="text-sm font-medium text-stone-500 uppercase tracking-wide flex items-center gap-2">
              <CalendarDays className="size-3.5" />
              Aankomende verblijven
            </h2>
            <div className="rounded-lg border border-stone-200 bg-white px-4 divide-y divide-stone-100">
              {upcoming.slice(0, 3).map((b) => (
                <UpcomingBookingRow key={b.id} booking={b} today={today} />
              ))}
            </div>
          </section>
        )}
      </div>
    </main>
  );
}
