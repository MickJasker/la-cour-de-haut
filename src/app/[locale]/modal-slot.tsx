"use client";

import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

/**
 * Client Components in a parallel-route slot aren't remounted by the App
 * Router on navigation — closing a modal leaves its `open` state at `false`,
 * so reopening it (same slug) reuses that stale instance and renders
 * nothing. Keying on the pathname forces a remount whenever it changes,
 * which it always does across an open/close cycle (the modal route vs. the
 * page it was intercepted from).
 */
export function ModalSlot({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  return <div key={pathname}>{children}</div>;
}
