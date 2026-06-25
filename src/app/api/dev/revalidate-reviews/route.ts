import { revalidateTag } from "next/cache";

export async function POST() {
  const isProd = process.env.NODE_ENV === "production";
  if (isProd && !process.env.E2E_TESTING) {
    return Response.json({ error: "not available" }, { status: 403 });
  }
  revalidateTag("reviews", { expire: 0 });
  return Response.json({ ok: true });
}
