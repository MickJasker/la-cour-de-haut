import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { admin } from "better-auth/plugins";
import { getDb } from "@/db";

function createAuth() {
  const secret = process.env.BETTER_AUTH_SECRET;
  const baseURL = process.env.BETTER_AUTH_URL;
  if (!secret) throw new Error("BETTER_AUTH_SECRET is not set");
  if (!baseURL) throw new Error("BETTER_AUTH_URL is not set");
  return betterAuth({
    secret,
    baseURL,
    database: drizzleAdapter(getDb(), { provider: "pg" }),
    emailAndPassword: { enabled: true, disableSignUp: true },
    plugins: [admin()],
  });
}

let _auth: ReturnType<typeof createAuth> | undefined;

export function getAuth() {
  return (_auth ??= createAuth());
}

export type Session = ReturnType<typeof createAuth>["$Infer"]["Session"];
