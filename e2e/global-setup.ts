import { spawnSync } from "child_process";
import { writeFileSync } from "fs";
import { neon } from "@neondatabase/serverless";

const BRANCH_ID_FILE = "/tmp/e2e-neon-branch-id";

export default async function globalSetup() {
  const apiKey = process.env.NEON_API_KEY;
  const projectId = process.env.NEON_PROJECT_ID;

  if (!apiKey || !projectId) {
    // Local dev without Neon isolation — use existing DATABASE_URL
    console.log(
      "[e2e] NEON_API_KEY not set — skipping branch creation, using existing DATABASE_URL",
    );
    return;
  }

  // 1. Create a new Neon branch
  const createRes = await fetch(
    `https://console.neon.tech/api/v2/projects/${projectId}/branches`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        branch: { name: `e2e-${Date.now()}` },
        endpoints: [{ type: "read_write" }],
      }),
    },
  );
  if (!createRes.ok) {
    const text = await createRes.text();
    throw new Error(`Neon branch creation failed: ${createRes.status} ${text}`);
  }
  const data = await createRes.json();
  const branchId: string = data.branch.id;
  // connection_uris is an array; pick the first (read_write endpoint)
  const connectionUri: string = data.connection_uris[0].connection_uri;

  // Save branch ID for teardown
  writeFileSync(BRANCH_ID_FILE, branchId, "utf-8");

  // Inject branch URL into process.env so everything downstream (migrations,
  // seed script, the Next.js webServer) uses the isolated branch.
  process.env.DATABASE_URL = connectionUri;
  process.env.DATABASE_URL_UNPOOLED = connectionUri;

  // 2. Apply migrations (drizzle-kit reads DATABASE_URL_UNPOOLED)
  const migrate = spawnSync("pnpm", ["db:migrate"], {
    stdio: "inherit",
    env: process.env,
  });
  if (migrate.status !== 0) throw new Error("pnpm db:migrate failed");

  // 3. Truncate all data to ensure clean state (branch may inherit parent data)
  const sql = neon(connectionUri);
  await sql`TRUNCATE "user", session, account, verification CASCADE`;

  // 4. Seed the owner account
  const seed = spawnSync("pnpm", ["seed-owner"], {
    stdio: "inherit",
    env: process.env,
  });
  if (seed.status !== 0) throw new Error("pnpm seed-owner failed");
}
