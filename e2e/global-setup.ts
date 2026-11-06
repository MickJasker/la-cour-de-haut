import { spawn, spawnSync, type ChildProcess } from "child_process";
import { existsSync } from "fs";
import { neon } from "@neondatabase/serverless";
import { request } from "@playwright/test";
import { blockedRange } from "./availability-fixture";
import { authFile } from "./constants";
import {
  BASE_PORT,
  WORKER_COUNT,
  WORKER_DB_URLS_KEY,
  workerBaseUrl,
} from "./isolation";
import { createBranch, deleteBranch, type NeonBranch } from "./neon-api";

// ADR-0027: one Neon branch + one `next start` server per worker.
//
//   default branch ──fork──▶ template  (migrated, truncated, owner + iCal seeded)
//                              ├─fork─▶ worker-0 branch ◀── server :BASE_PORT
//                              ├─fork─▶ worker-1 branch ◀── server :BASE_PORT+1
//                              └─ …
//
// Forking workers from a migrated+seeded template keeps setup O(1) in the work
// that matters (build, migrate, seed) and gives every worker the *same* owner
// user id, which lets one signed-in session be copied into all of them.

const run = process.env.GITHUB_RUN_ID
  ? `${process.env.GITHUB_RUN_ID}-${process.env.GITHUB_RUN_ATTEMPT ?? 1}`
  : `local-${process.pid}`;

const nextBin = require.resolve("next/dist/bin/next");

function sh(cmd: string, args: string[], env: NodeJS.ProcessEnv) {
  const res = spawnSync(cmd, args, { stdio: "inherit", env });
  if (res.status !== 0) throw new Error(`${cmd} ${args.join(" ")} failed`);
}

async function waitForServer(url: string, server: ChildProcess) {
  const deadline = Date.now() + 120_000;
  while (Date.now() < deadline) {
    if (server.exitCode !== null)
      throw new Error(`next start for ${url} exited early`);
    try {
      if ((await fetch(`${url}/nl`)).ok) return;
    } catch {}
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error(`Timed out waiting for ${url}`);
}

export default async function globalSetup() {
  let template: NeonBranch | undefined;
  let workerBranches: NeonBranch[] = [];
  const servers: ChildProcess[] = [];

  const teardown = async () => {
    for (const s of servers) s.kill("SIGTERM");
    // Neon refuses to delete a branch that still has children: workers first.
    await Promise.allSettled(workerBranches.map((b) => deleteBranch(b.id)));
    // Deletion is asynchronous, so the template stays "parent of a branch" for a
    // moment after the workers' DELETEs return — retry until Neon lets it go.
    for (let attempt = 0; template && attempt < 10; attempt++) {
      try {
        await deleteBranch(template.id);
        break;
      } catch {
        await new Promise((r) => setTimeout(r, 3000));
      }
    }
  };

  try {
    // 1. Template branch: build (which also migrates) and seed once.
    template = await createBranch(`e2e-${run}-template`);
    // The build, seed scripts and servers never call the Neon API; keep its
    // credentials out of their environment (least privilege).
    const baseEnv = { ...process.env };
    delete baseEnv.NEON_API_KEY;
    delete baseEnv.NEON_PROJECT_ID;
    const templateEnv = {
      ...baseEnv,
      DATABASE_URL: template.pooledUrl,
      DATABASE_URL_UNPOOLED: template.directUrl,
      E2E_TESTING: "1",
      NEXT_PUBLIC_E2E_TESTING: "1",
    };

    // A production build is what we serve (ADR-0009). E2E_SKIP_BUILD=1 reuses
    // an existing `.next` for fast local iteration — but the build bakes in
    // NEXT_PUBLIC_E2E_TESTING, so only reuse one made by this suite.
    if (process.env.E2E_SKIP_BUILD && existsSync(".next/BUILD_ID")) {
      sh("pnpm", ["db:migrate"], templateEnv);
    } else {
      sh("pnpm", ["build"], templateEnv);
    }

    const sql = neon(template.pooledUrl);
    await sql`TRUNCATE "user", session, account, verification, ical_source, booking_request, setting, review, owner_block CASCADE`;
    sh("pnpm", ["seed-owner"], templateEnv);
    // Pre-cached intervals so no network fetch is needed during tests. Dates are
    // dynamic to stay within the booking window.
    await sql`
      INSERT INTO ical_source (id, name, url, enabled, cached_intervals, last_synced_at, created_at, updated_at)
      VALUES (
        'test-ical-source',
        'Test Source',
        'https://example.com/test.ics',
        true,
        ${JSON.stringify([{ start: blockedRange.start, end: blockedRange.endExclusive }])}::jsonb,
        now(),
        now(),
        now()
      )
    `;

    // 2. One branch per worker, forked from the template.
    const parentId = template.id;
    workerBranches = await Promise.all(
      Array.from({ length: WORKER_COUNT }, (_, i) =>
        createBranch(`e2e-${run}-w${i}`, parentId),
      ),
    );
    // Workers inherit this env at fork; applyWorkerEnv() reads it back.
    process.env[WORKER_DB_URLS_KEY] = JSON.stringify(
      workerBranches.map((b) => b.pooledUrl),
    );

    // 3. One server per worker branch.
    workerBranches.forEach((branch, i) => {
      const port = BASE_PORT + i;
      // Run next directly (not via `pnpm exec`): SIGTERM must hit the server
      // itself, not a wrapper that would orphan it and keep the port bound.
      const server = spawn(
        process.execPath,
        [nextBin, "start", "-p", String(port)],
        {
          stdio: "inherit",
          env: {
            ...templateEnv,
            DATABASE_URL: branch.pooledUrl,
            DATABASE_URL_UNPOOLED: branch.directUrl,
            PORT: String(port),
            BETTER_AUTH_URL: workerBaseUrl(i),
          },
        },
      );
      servers.push(server);
    });
    await Promise.all(
      servers.map((s, i) => waitForServer(workerBaseUrl(i), s)),
    );

    // 4. Sign the owner in once (server 0) and copy that session row into the
    // other branches. Same BETTER_AUTH_SECRET + same user id ⇒ the one cookie
    // saved to `authFile` is valid against every worker's server, since
    // cookies aren't port-scoped.
    const email = process.env.OWNER_EMAIL;
    const password = process.env.OWNER_PASSWORD;
    if (!email || !password)
      throw new Error("OWNER_EMAIL and OWNER_PASSWORD must be set");
    const ctx = await request.newContext({ baseURL: workerBaseUrl(0) });
    const res = await ctx.post("/api/auth/sign-in/email", {
      data: { email, password },
    });
    if (!res.ok())
      throw new Error(
        `Owner sign-in failed (${res.status()}): ${await res.text()}`,
      );
    await ctx.storageState({ path: authFile });
    await ctx.dispose();

    const sessions = await neon(
      workerBranches[0].pooledUrl,
    )`SELECT * FROM session`;
    for (const branch of workerBranches.slice(1)) {
      const target = neon(branch.pooledUrl);
      for (const row of sessions) {
        await target`INSERT INTO session SELECT * FROM json_populate_record(null::session, ${JSON.stringify(row)}::json)`;
      }
    }
  } catch (err) {
    await teardown();
    throw err;
  }

  // Playwright awaits the returned function after the run (pass or fail).
  return teardown;
}
