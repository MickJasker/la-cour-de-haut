import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  cacheComponents: true,
  experimental: {
    serverActions: {
      bodySizeLimit: "20mb",
    },
    // Multiple root layouts (`[locale]` + `admin`) plus a top-level dynamic
    // `[locale]` segment mean there is no `app/layout.tsx` to host an
    // `app/not-found.tsx`. `global-not-found.tsx` is the documented catch-all for
    // unmatched URLs in this shape. See ADR-0011.
    globalNotFound: true,
  },
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "**.public.blob.vercel-storage.com" },
      { protocol: "https", hostname: "picsum.photos" },
    ],
  },
  reactCompiler: true,
  // `happy-dom` is loaded lazily inside the POI rich-text translation server
  // action (EditorState <-> HTML bridge); keep it external so Turbopack never
  // pulls it into the client/prerender graph. See ADR-0015.
  serverExternalPackages: ["better-auth", "node-ical", "happy-dom"],
  turbopack: {
    // better-auth bundles kysely-adapter SQLite dialects that reference internal
    // kysely exports moved to kysely/migration in 0.29.x. We use drizzleAdapter
    // so these code paths are never exercised at runtime.
    ignoreIssue: [
      {
        path: /@better-auth\/kysely-adapter/,
        title: /doesn't exist in target module/,
      },
    ],
  },
};

export default nextConfig;
