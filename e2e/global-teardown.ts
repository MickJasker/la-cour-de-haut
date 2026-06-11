import { existsSync, readFileSync, unlinkSync } from "fs";

const BRANCH_ID_FILE = "/tmp/e2e-neon-branch-id";

export default async function globalTeardown() {
  if (!existsSync(BRANCH_ID_FILE)) return;

  const branchId = readFileSync(BRANCH_ID_FILE, "utf-8").trim();
  unlinkSync(BRANCH_ID_FILE);

  const apiKey = process.env.NEON_API_KEY;
  const projectId = process.env.NEON_PROJECT_ID;
  if (!apiKey || !projectId || !branchId) return;

  const res = await fetch(
    `https://console.neon.tech/api/v2/projects/${projectId}/branches/${branchId}`,
    {
      method: "DELETE",
      headers: { Authorization: `Bearer ${apiKey}` },
    },
  );
  if (!res.ok) {
    console.error(
      `[e2e] Failed to delete Neon branch ${branchId}: ${res.status}`,
    );
  } else {
    console.log(`[e2e] Deleted Neon branch ${branchId}`);
  }
}
