import { revalidateTag } from "next/cache";
import type { NextRequest } from "next/server";

// Dev/test only — immediately expires a named cache tag so Playwright tests
// that mutate the DB via raw SQL see fresh data on their next navigation.
// Production mutations go through Server Actions that call updateTag directly;
// this Route Handler exists only because tests bypass those actions.
//
// `{ expire: 0 }` forces synchronous expiry rather than the default
// stale-while-revalidate behaviour that cacheLife profiles use.
//
// Gate: available in development always; in production only when E2E_TESTING
// is set (i.e. a CI test run against `next start`), never in real deploys.

const KNOWN_TAGS = new Set([
  "gallery",
  "reviews",
  "settings",
  "poi",
  "content",
  "pages",
]);

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ tag: string }> },
) {
  const isProd = process.env.NODE_ENV === "production";
  if (isProd && !process.env.E2E_TESTING) {
    return Response.json({ error: "not available" }, { status: 403 });
  }

  const { tag } = await params;
  if (!KNOWN_TAGS.has(tag)) {
    return Response.json({ error: `unknown tag: ${tag}` }, { status: 400 });
  }

  revalidateTag(tag, { expire: 0 });
  return Response.json({ ok: true });
}
