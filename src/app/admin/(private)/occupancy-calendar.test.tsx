import { describe, it, expect } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { OccupancyCalendar } from "./occupancy-calendar";
import type { OccupancyEntry } from "@/lib/booking/occupancy-calendar";

const ENTRIES: OccupancyEntry[] = [
  {
    kind: "booking",
    id: "b-hold",
    name: "Lars Janssen",
    status: "on_hold",
    start: "2026-07-06",
    end: "2026-07-09",
  },
  {
    kind: "booking",
    id: "b-conf",
    name: "Emma Leclerc",
    status: "confirmed",
    start: "2026-07-10",
    end: "2026-07-15",
  },
  {
    kind: "booking",
    id: "b-dep",
    name: "Sophie Martin",
    status: "deposit_paid",
    start: "2026-07-16",
    end: "2026-07-19",
  },
  {
    kind: "ical",
    sourceName: "Airbnb",
    start: "2026-07-20",
    end: "2026-07-24",
  },
];

function render(month = "2026-07") {
  return renderToStaticMarkup(
    <OccupancyCalendar entries={ENTRIES} initialMonth={month} />,
  );
}

describe("OccupancyCalendar", () => {
  it("renders the month label and Monday-start weekday headers", () => {
    const html = render();
    expect(html).toContain("juli 2026");
    for (const day of ["ma", "di", "wo", "do", "vr", "za", "zo"]) {
      expect(html).toContain(`>${day}<`);
    }
  });

  it("renders prev/next month navigation buttons", () => {
    const html = render();
    expect(html).toContain('aria-label="Vorige maand"');
    expect(html).toContain('aria-label="Volgende maand"');
  });

  it("renders an on_hold booking as an amber link to its inbox card", () => {
    const html = render();
    expect(html).toContain("Lars Janssen");
    expect(html).toContain('href="/admin/bookings#booking-b-hold"');
    expect(html).toContain("bg-amber-200");
  });

  it("renders a confirmed booking as a green link to its inbox card", () => {
    const html = render();
    expect(html).toContain("Emma Leclerc");
    expect(html).toContain('href="/admin/bookings#booking-b-conf"');
    expect(html).toContain("bg-green-200");
  });

  it("renders a deposit_paid booking as a blue link to its inbox card (issue #166 spec)", () => {
    const html = render();
    expect(html).toContain("Sophie Martin");
    expect(html).toContain('href="/admin/bookings#booking-b-dep"');
    expect(html).toContain("bg-blue-200");
  });

  it("renders an iCal interval as a grey, non-clickable span with the source name", () => {
    const html = render();
    expect(html).toContain("Airbnb");
    expect(html).toContain("bg-stone-200");
    expect(html).not.toContain('href="/admin/bookings#booking-ical');
  });

  it("renders nothing for entries outside the shown month", () => {
    const html = render("2026-09");
    expect(html).toContain("september 2026");
    expect(html).not.toContain("Emma Leclerc");
    expect(html).not.toContain("Airbnb");
  });
});
