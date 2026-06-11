import { test as setup } from "@playwright/test";
import path from "path";

export const authFile = path.join(__dirname, ".auth/owner.json");

setup("acquire owner session", async ({ request }) => {
  const email = process.env.OWNER_EMAIL;
  const password = process.env.OWNER_PASSWORD;
  if (!email || !password)
    throw new Error("OWNER_EMAIL and OWNER_PASSWORD must be set");

  const res = await request.post("/api/auth/sign-in/email", {
    data: { email, password },
  });
  if (!res.ok()) {
    const body = await res.text();
    throw new Error(`Auth setup failed (${res.status()}): ${body}`);
  }

  // Save the session cookies to disk for authenticated test contexts
  await request.storageState({ path: authFile });
});
