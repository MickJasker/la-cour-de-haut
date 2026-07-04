import type { MetadataRoute } from "next";

/**
 * Web app manifest. `start_url` points at the default locale (matches the
 * sitemap's `x-default` → `/nl`). Icons reference the app's `icon.svg` (scales
 * to any size) plus the generated `apple-icon` PNG. Colors are the brand
 * forest/cream so an installed shortcut and the browser chrome stay on-brand.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "La Cour de Haut — Gîte in Normandy",
    short_name: "La Cour de Haut",
    description:
      "Charming gîte in the Normandy countryside, France — check availability and book your stay.",
    start_url: "/nl",
    display: "standalone",
    background_color: "#fffaf0",
    theme_color: "#4b5a23",
    icons: [
      { src: "/icon.svg", type: "image/svg+xml", sizes: "any" },
      { src: "/apple-icon", type: "image/png", sizes: "180x180" },
    ],
  };
}
