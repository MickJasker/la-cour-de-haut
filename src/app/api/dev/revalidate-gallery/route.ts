import { revalidateTag } from "next/cache";

// Dev/test only — immediately expires the `gallery` cache tag (the tag set by
// GiteSection's `use cache`) so Playwright tests that seed gallery_image via raw
// SQL — outside any Server Action — see fresh data on their next navigation.
//
// Production gallery mutations invalidate via `updateTag` from their Server
// Actions; this Route Handler exists only because tests bypass those actions.
// `{ expire: 0 }` forces immediate (blocking) expiration, which `revalidateTag`'s
// default stale-while-revalidate ("max") profile does not.
//
// E2E now runs against a production build (`next start`), where NODE_ENV is
// "production" — so the gate also allows E2E_TESTING. It stays closed for a real
// production deploy (E2E_TESTING unset).
export async function POST() {
  const isProd = process.env.NODE_ENV === "production";
  if (isProd && !process.env.E2E_TESTING) {
    return Response.json({ error: "not available" }, { status: 403 });
  }
  revalidateTag("gallery", { expire: 0 });
  return Response.json({ ok: true });
}
