/**
 * One-time script to create the owner account.
 * Run with: npx tsx scripts/seed-owner.ts
 *
 * Set OWNER_EMAIL and OWNER_PASSWORD in .env.local before running.
 */
import { auth } from "../src/lib/auth";

try {
  process.loadEnvFile(".env.local");
} catch {}

const email = process.env.OWNER_EMAIL;
const password = process.env.OWNER_PASSWORD;
const name = process.env.OWNER_NAME ?? "Owner";

if (!email || !password) {
  console.error("OWNER_EMAIL and OWNER_PASSWORD must be set in .env.local");
  process.exit(1);
}

const result = await auth.api.createUser({
  body: { email, password, name, role: "admin" },
});

console.log("Owner created:", result.user.id, result.user.email);
