import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    serverActions: {
      bodySizeLimit: "10mb",
    },
  },
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "**.public.blob.vercel-storage.com" },
      { protocol: "https", hostname: "picsum.photos" },
    ],
  },
  reactCompiler: true,
  serverExternalPackages: ["better-auth", "node-ical"],
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
