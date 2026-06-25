/**
 * One-time script to create the owner account.
 * Run with: pnpm seed-owner
 *
 * Set OWNER_EMAIL and OWNER_PASSWORD in .env.local before running.
 */
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

// Dynamic import so env is populated before auth.ts module-level validation runs
const { getAuth } = await import("../src/lib/auth.js");

try {
  const result = await getAuth().api.createUser({
    body: { email, password, name, role: "admin" },
  });

  console.log("Owner created:", result.user.id, result.user.email);
} catch (err) {
  if (err instanceof Error) {
    console.error("Error creating owner:", err.message);
  } else {
    console.error("Error creating owner:", err);
  }
}
