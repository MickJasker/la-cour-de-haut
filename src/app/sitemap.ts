import type { MetadataRoute } from "next";
import { locales } from "@/i18n/routing";

const BASE_URL = process.env.NEXT_PUBLIC_APP_URL ?? "https://lacourdehaut.fr";

const PUBLIC_PATHS = ["", "/book", "/privacy"] as const;

export default function sitemap(): MetadataRoute.Sitemap {
  return PUBLIC_PATHS.flatMap((path) =>
    locales.map((locale) => ({
      url: `${BASE_URL}/${locale}${path}`,
      alternates: {
        languages: Object.fromEntries([
          ...locales.map((loc) => [loc, `${BASE_URL}/${loc}${path}`]),
          ["x-default", `${BASE_URL}/nl${path}`],
        ]),
      },
    })),
  );
}
