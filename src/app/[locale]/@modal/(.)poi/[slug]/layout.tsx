import { PoiModalShell } from "./poi-modal-client";

/**
 * Segment layout for the intercepted POI modal. Owns the Dialog shell so it
 * persists across the `loading.tsx` → `page.tsx` Suspense swap (see
 * PoiModalShell). Deliberately synchronous — no data fetch here — so the
 * skeleton fallback can paint the instant the route is entered; the POI read
 * that used to block the modal now sits behind the Suspense boundary in page.tsx.
 */
export default function PoiModalLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <PoiModalShell>{children}</PoiModalShell>;
}
