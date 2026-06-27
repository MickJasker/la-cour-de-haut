import { getDb } from "@/db";
import { icalExportToken } from "@/db/schema";
import { eq } from "drizzle-orm";
import { getDirectBookings } from "@/lib/availability";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ token: string }> },
) {
  const { token: rawToken } = await params;
  const token = rawToken.replace(/\.ics$/, "");

  const db = getDb();
  const [row] = await db
    .select({ id: icalExportToken.id })
    .from(icalExportToken)
    .where(eq(icalExportToken.token, token));

  if (!row) {
    return new Response("Not found", { status: 404 });
  }

  void db
    .update(icalExportToken)
    .set({ lastAccessedAt: new Date() })
    .where(eq(icalExportToken.id, row.id))
    .catch(console.error);

  const bookings = await getDirectBookings();

  // RFC 5545 §3.3.5 — basic date-time stamp: YYYYMMDDTHHmmssZ
  const dtstamp = new Date()
    .toISOString()
    .replace(/[-:]/g, "")
    .replace(/\.\d{3}/, "");

  const toDate = (s: string) => s.replace(/-/g, "");

  const vevents = bookings
    .map((b) =>
      [
        "BEGIN:VEVENT",
        `UID:booking-${b.id}@lacourdehaut.fr`,
        `DTSTAMP:${dtstamp}`,
        `DTSTART;VALUE=DATE:${toDate(b.startDate)}`,
        `DTEND;VALUE=DATE:${toDate(b.endDate)}`,
        "SUMMARY:Booked",
        "END:VEVENT",
      ].join("\r\n"),
    )
    .join("\r\n");

  const ics = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//La Cour de Haut//Booking Feed//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    ...(bookings.length > 0 ? [vevents] : []),
    "END:VCALENDAR",
  ].join("\r\n");

  return new Response(ics, {
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Cache-Control": "no-store",
    },
  });
}
