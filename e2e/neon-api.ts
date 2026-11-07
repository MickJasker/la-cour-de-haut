const API = "https://console.neon.tech/api/v2";

export interface NeonBranch {
  id: string;
  /** Direct (unpooled) URL — required for DDL migrations (PgBouncer blocks DDL). */
  directUrl: string;
  /** Pooled URL — `-pooler` inserted into the endpoint hostname (repo convention). */
  pooledUrl: string;
}

function credentials() {
  const key = process.env.NEON_API_KEY;
  const project = process.env.NEON_PROJECT_ID;
  if (!key || !project)
    throw new Error(
      "NEON_API_KEY and NEON_PROJECT_ID must be set: the e2e suite creates a Neon branch per worker (ADR-0027)",
    );
  return { key, project };
}

const MAX_ATTEMPTS = 5;

/**
 * 409/423 (project locked by a concurrent
 * operation), 429 (rate limit), any 5xx, and 406 (branch/endpoint limit exceeded —
 * sibling `e2e-*` branches are deleted as their runs finish, freeing capacity).
 * Everything else (400/401/403/404) is a credential/config bug: fail fast
 * rather than hide it behind retries.
 */
export function isRetryable(status: number) {
  return status >= 500 || [406, 409, 423, 429].includes(status);
}

/** ~5, 10, 20, 40, 40s, jittered ±25% so parallel runs don't retry in lockstep. */
export function retryDelayMs(attempt: number, random = Math.random) {
  const base = Math.min(5000 * 2 ** attempt, 40_000);
  return Math.round(base * (0.75 + 0.5 * random()));
}

interface NeonRequestDeps {
  fetch: typeof fetch;
  sleep: (ms: number) => Promise<unknown>;
  random: () => number;
}

const defaultDeps: NeonRequestDeps = {
  fetch: (...args) => fetch(...args),
  sleep: (ms) => new Promise((r) => setTimeout(r, ms)),
  random: Math.random,
};

/** Exported for tests; `deps` makes the retry loop deterministic and instant. */
export async function neonRequest(
  path: string,
  init: RequestInit,
  { key, project }: { key: string; project: string },
  deps: NeonRequestDeps = defaultDeps,
) {
  let lastError = "";
  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    const res = await deps.fetch(`${API}/projects/${project}${path}`, {
      ...init,
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
        ...init.headers,
      },
    });
    if (res.ok) return res.json();
    // Always keep the Neon error body: it names the actual cause (limit, auth…).
    lastError = `${res.status} ${await res.text()}`;
    if (!isRetryable(res.status)) break;
    if (attempt < MAX_ATTEMPTS - 1)
      await deps.sleep(retryDelayMs(attempt, deps.random));
  }
  throw new Error(
    `Neon API ${init.method ?? "GET"} ${path} failed: ${lastError}`,
  );
}

function neonFetch(path: string, init: RequestInit = {}) {
  return neonRequest(path, init, credentials());
}

/** Create a read-write branch. Without `parentId` it forks the default branch. */
export async function createBranch(
  name: string,
  parentId?: string,
): Promise<NeonBranch> {
  const body = await neonFetch("/branches", {
    method: "POST",
    body: JSON.stringify({
      branch: { name, ...(parentId ? { parent_id: parentId } : {}) },
      endpoints: [{ type: "read_write" }],
    }),
  });
  const directUrl: string = body.connection_uris[0].connection_uri;
  return {
    id: body.branch.id,
    directUrl,
    pooledUrl: directUrl.replace(/@([^.]+)\./, "@$1-pooler."),
  };
}

export async function deleteBranch(id: string) {
  await neonFetch(`/branches/${id}`, { method: "DELETE" });
}
