"use client";
import { useMemo } from "react";
import { useI18n } from "./provider";
import { resolveMessage } from "./resolve";

// Plain (non-ICU) client translations. Resolves a message string and performs
// simple `{name}` interpolation — no plurals/select/number/date formatting, and
// crucially no `intl-messageformat` import. Use for Client Components that only
// render plain-string copy: notably the `error` / `not-found` boundaries, which
// Next eagerly bundles into every route (including the homepage). Routing those
// through the full ICU engine would ship ~34 KiB of unused JavaScript on pages
// that never format a message on the client. For messages that use ICU features
// (plural/select/etc.) use `useTranslations` from `./use-translations` instead.
type Values = Record<string, string | number>;

export function usePlainTranslations(
  namespace?: string,
): (key: string, values?: Values) => string {
  const { messages } = useI18n();
  return useMemo(
    () => (key: string, values?: Values) => {
      const msg = resolveMessage(messages, namespace, key);
      if (!values) return msg;
      return msg.replace(/\{(\w+)\}/g, (whole, name: string) =>
        name in values ? String(values[name]) : whole,
      );
    },
    [messages, namespace],
  );
}
