import { useSyncExternalStore } from "react";

const emptySubscribe = () => () => {};

/**
 * `false` during SSR and the initial hydration render, `true` afterwards.
 *
 * Use this to disable controls whose interactions exist only as React event
 * handlers: before hydration those handlers aren't attached, and React does
 * not replay discrete events (click, change, …) that fire on a not-yet
 * hydrated tree — the interaction is silently dropped. A file input is the
 * canonical victim: the browser opens the native picker without JS (via its
 * `<label>`), but the resulting `change` event lands on deaf ears and the
 * user's selection vanishes without feedback (issue #159).
 *
 * `useSyncExternalStore` with a constant server snapshot is React's
 * documented way to detect hydration without a useEffect+setState cycle.
 */
export function useIsHydrated(): boolean {
  return useSyncExternalStore(
    emptySubscribe,
    () => true,
    () => false,
  );
}
