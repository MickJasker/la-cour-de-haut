import "server-only";
import { cache } from "react";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { getAuth } from "@/lib/auth";

export const verifySession = cache(async () => {
  const session = await getAuth().api.getSession({ headers: await headers() });
  if (!session) redirect("/admin/login");
  return session;
});
