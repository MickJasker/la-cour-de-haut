import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { getAuth } from "@/lib/auth";
import { LoginForm } from "./login-form";

export default async function LoginPage() {
  // Await headers() before getAuth() so the admin layout's <Suspense> boundary
  // bails into a dynamic hole during prerender — otherwise getAuth() (reading
  // env absent at build time) throws while prerendering. See lib/dal.ts.
  const requestHeaders = await headers();
  const session = await getAuth().api.getSession({ headers: requestHeaders });
  if (session) redirect("/admin");
  return <LoginForm />;
}
