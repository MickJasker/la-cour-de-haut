import React from "react";
import { locales } from "@/i18n/routing";
import type { Locale } from "@/i18n/routing";
import { cn } from "@/lib/utils";

const localeDisplayName: Record<Locale, string> = {
  nl: "Nederlands",
  en: "Engels",
  fr: "Frans",
  de: "Duits",
};

export function LocaleStatus(props: {
  /** The source map stored per field: a present key means that locale is translated. */
  source: Partial<Record<Locale, "human" | "machine">>;
  className?: string;
}): React.JSX.Element {
  const { source, className } = props;

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 text-xs text-stone-500",
        className,
      )}
    >
      {locales.map((locale, i) => {
        const present = locale in source;
        return (
          <React.Fragment key={locale}>
            {i > 0 && (
              <span aria-hidden="true" className="text-stone-300">
                ·
              </span>
            )}
            <span
              aria-label={`${localeDisplayName[locale]}: ${present ? "vertaald" : "ontbreekt"}`}
              className={present ? "text-green-700" : "text-amber-600"}
            >
              {locale.toUpperCase()} {present ? "✓" : "⚠"}
            </span>
          </React.Fragment>
        );
      })}
    </span>
  );
}
