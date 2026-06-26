import { revalidateTag } from "next/cache";

// Dev/test only — immediately expires the `settings` cache tag so Playwright
// tests that mutate the setting table via raw SQL see fresh data on their next
// navigation. Production mutations go through upsertSetting which calls
// updateTag; this Route Handler exists only because tests bypass that path.
// E2E_TESTING gate keeps this closed in real production deploys.
export async function POST() {
  const isProd = process.env.NODE_ENV === "production";
  if (isProd && !process.env.E2E_TESTING) {
    return Response.json({ error: "not available" }, { status: 403 });
  }
  revalidateTag("settings", { expire: 0 });
  return Response.json({ ok: true });
}
