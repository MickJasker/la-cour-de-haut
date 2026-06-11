import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { getAuth } from "@/lib/auth";
import { LoginForm } from "./login-form";

export default async function LoginPage() {
  const session = await getAuth().api.getSession({ headers: await headers() });
  if (session) redirect("/admin");
  return <LoginForm />;
}
