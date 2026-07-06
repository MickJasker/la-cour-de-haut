import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  cacheComponents: true,
  // The OG/apple-icon routes read source assets at generation time via
  // `process.cwd()` + a literal path. `@vercel/nft` usually traces literal
  // reads, but declaring them guarantees the files ship in the function bundle
  // even if a route is ever served dynamically (avoids a runtime ENOENT → 500).
  outputFileTracingIncludes: {
    "/[locale]/opengraph-image": ["./src/components/sections/hero.jpg"],
    "/[locale]/twitter-image": ["./src/components/sections/hero.jpg"],
    "/apple-icon": ["./src/app/icon.svg"],
  },
  experimental: {
    serverActions: {
      bodySizeLimit: "20mb",
    },
    // The proxy (src/proxy.ts) matches /admin/* and buffers the whole request
    // body before forwarding it, capped by this limit (default 10mb). Image
    // uploads POST multipart bodies through the POI/gallery/hero server actions,
    // so this must be >= serverActions.bodySizeLimit or the body is truncated
    // mid-upload and FormData parsing fails with "Unexpected end of form".
    // (Next 16 renamed `middlewareClientMaxBodySize` to this.)
    proxyClientMaxBodySize: "20mb",
    // Multiple root layouts (`[locale]` + `admin`) plus a top-level dynamic
    // `[locale]` segment mean there is no `app/layout.tsx` to host an
    // `app/not-found.tsx`. `global-not-found.tsx` is the documented catch-all for
    // unmatched URLs in this shape. See ADR-0011.
    globalNotFound: true,
  },
  images: {
    // AVIF first (best compression, ~20% smaller than WebP), WebP fallback for
    // browsers without AVIF support. Next.js picks per-request via the `Accept`
    // header. Default was `["image/webp"]` only. See PageSpeed `image-delivery`.
    formats: ["image/avif", "image/webp"],
    remotePatterns: [
      { protocol: "https", hostname: "**.public.blob.vercel-storage.com" },
      { protocol: "https", hostname: "picsum.photos" },
    ],
  },
  reactCompiler: true,
  // `happy-dom` is loaded lazily inside the POI rich-text translation server
  // action (EditorState <-> HTML bridge); keep it external so Turbopack never
  // pulls it into the client/prerender graph. See ADR-0015.
  // `@google-cloud/translate` ships AMD-wrapped generated protos whose
  // `define(["protobufjs/minimal"])` branch Turbopack tries to resolve from the
  // package's own context — unresolvable under pnpm's strict layout (protobufjs
  // is google-gax's dep, not translate's). Dev-only failure; keep the whole
  // client external so Node resolves it at runtime.
  serverExternalPackages: [
    "better-auth",
    "node-ical",
    "happy-dom",
    "@google-cloud/translate",
  ],
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
