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

async function neonFetch(path: string, init: RequestInit = {}) {
  const { key, project } = credentials();
  let lastError = "";
  // Neon locks a branch while an operation is in flight (409/423) and rate
  // limits bursts (429); retry those with backoff instead of failing the run.
  for (let attempt = 0; attempt < 6; attempt++) {
    const res = await fetch(`${API}/projects/${project}${path}`, {
      ...init,
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
        ...init.headers,
      },
    });
    if (res.ok) return res.json();
    lastError = `${res.status} ${await res.text()}`;
    if (![409, 423, 429, 500, 502, 503].includes(res.status)) break;
    await new Promise((r) => setTimeout(r, 1000 * 2 ** attempt));
  }
  throw new Error(
    `Neon API ${init.method ?? "GET"} ${path} failed: ${lastError}`,
  );
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
