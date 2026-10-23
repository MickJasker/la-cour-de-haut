"use client";

import { useSyncExternalStore } from "react";
import { createPortal } from "react-dom";

/**
 * Reserves the fixed header's height at the end of <main>'s parent so the page
 * content isn't hidden behind it. Portaled after mount (the server snapshot is
 * `null`), reads no URL data, so it prerenders and hydrates with the shell.
 */
export function HeaderSpacer() {
  const mainEl = useSyncExternalStore(
    () => () => {},
    () => document.querySelector<HTMLElement>("main")?.parentElement,
    () => null,
  );
  return mainEl ? createPortal(<div className="h-22" />, mainEl) : null;
}
