import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { getDb } from "@/db";

const secret = process.env.BETTER_AUTH_SECRET;
const baseURL = process.env.BETTER_AUTH_URL;
if (!secret) throw new Error("BETTER_AUTH_SECRET is not set");
if (!baseURL) throw new Error("BETTER_AUTH_URL is not set");

export const auth = betterAuth({
  secret,
  baseURL,
  database: drizzleAdapter(getDb(), {
    provider: "pg",
  }),
  emailAndPassword: {
    enabled: true,
    disableSignUp: true,
  },
});

export type Session = typeof auth.$Infer.Session;
