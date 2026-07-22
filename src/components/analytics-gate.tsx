"use client";

import { Analytics } from "@vercel/analytics/next";
import { useIsHydrated } from "@/hooks/use-is-hydrated";

// Under Cache Components, <Analytics />'s useSearchParams read logs build
// noise unless it only ever renders client-side after hydration — a plain
// Suspense boundary does not silence it (ADR-0023).
export function AnalyticsGate() {
  const isHydrated = useIsHydrated();
  if (!isHydrated) return null;
  return <Analytics />;
}
