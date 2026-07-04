import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { hasLocale } from "@/i18n/routing";
import { renderOgCard, OG_SIZE, OG_CONTENT_TYPE } from "@/lib/seo/og-card";

export const alt = "La Cour de Haut — Gîte in Normandy, France";
export const size = OG_SIZE;
export const contentType = OG_CONTENT_TYPE;

// Localized one-line positioning for the share card (kept local to the route
// so the image stays a self-contained, statically-optimized asset).
const SUBTITLE: Record<string, string> = {
  nl: "Vakantiehuis in Normandië, Frankrijk",
  fr: "Gîte de charme en Normandie, France",
  en: "Gîte in Normandy, France",
  de: "Ferienhaus in der Normandie, Frankreich",
};

export default async function Image({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const loc = hasLocale(locale) ? locale : "nl";

  const hero = await readFile(
    join(process.cwd(), "src/components/sections/hero.jpg"),
    "base64",
  );

  return renderOgCard({
    eyebrow: "La Cour de Haut",
    title: SUBTITLE[loc] ?? SUBTITLE.nl,
    subtitle: "lacourdehaut.fr",
    backgroundSrc: `data:image/jpeg;base64,${hero}`,
  });
}
