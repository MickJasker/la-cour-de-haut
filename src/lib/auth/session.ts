import "server-only";
import { cache } from "react";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { getAuth } from "@/lib/auth/auth";

export const verifySession = cache(async () => {
  // Access request data (headers) BEFORE constructing auth. Under Cache
  // Components, awaiting headers() lets the admin tree's <Suspense> boundary
  // bail into a dynamic hole during prerender — so getAuth() (which reads env
  // not present at build time) never runs at build, only at request time.
  // JS evaluates `getAuth()` before `await headers()` when both are inline,
  // which previously threw "BETTER_AUTH_URL is not set" while prerendering.
  const requestHeaders = await headers();
  const session = await getAuth().api.getSession({ headers: requestHeaders });
  if (!session) redirect("/admin/login");
  return session;
});
