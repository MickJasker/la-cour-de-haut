import { revalidateTag } from "next/cache";

// Dev/test only — immediately expires the `gallery` cache tag (the tag set by
// GiteSection's `use cache`) so Playwright tests that seed gallery_image via raw
// SQL — outside any Server Action — see fresh data on their next navigation.
//
// Production gallery mutations invalidate via `updateTag` from their Server
// Actions; this Route Handler exists only because tests bypass those actions.
// `{ expire: 0 }` forces immediate (blocking) expiration, which `revalidateTag`'s
// default stale-while-revalidate ("max") profile does not.
export async function POST() {
  if (process.env.NODE_ENV === "production") {
    return Response.json({ error: "not available" }, { status: 403 });
  }
  revalidateTag("gallery", { expire: 0 });
  return Response.json({ ok: true });
}
