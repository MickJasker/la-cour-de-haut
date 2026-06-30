import React from "react";
import { locales } from "@/i18n/routing";
import type { Locale } from "@/i18n/routing";
import { cn } from "@/lib/utils";
import { Languages, Check, TriangleAlert } from "lucide-react";

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
        "flex items-center gap-1.5 text-xs text-stone-500",
        className,
      )}
    >
      <Languages className="w-4 h-4" />
      {locales.map((locale) => {
        const present = locale in source;
        return (
          <React.Fragment key={locale}>
            <span
              aria-label={`${localeDisplayName[locale]}: ${present ? "vertaald" : "ontbreekt"}`}
              className={cn(
                "flex items-center gap-1",
                present ? "text-green-700" : "text-amber-600",
              )}
            >
              {locale.toUpperCase()}{" "}
              {present ? (
                <Check className="w-4 h-4 inline" />
              ) : (
                <TriangleAlert className="w-4 h-4 inline" />
              )}
            </span>
          </React.Fragment>
        );
      })}
    </span>
  );
}
