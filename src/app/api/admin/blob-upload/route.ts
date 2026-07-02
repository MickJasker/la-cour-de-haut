import { verifySession } from "@/lib/dal";
import { getBlobUploadAdapter } from "./adapter";

// Token endpoint for client-side direct-to-Blob uploads (see issue #98). The
// browser streams the file straight to Vercel Blob instead of through a
// server action, which avoids both the proxy body-buffer limit
// (proxyClientMaxBodySize, src/proxy.ts) and the Vercel Functions
// request-body limit that a server action's put() would otherwise hit.
export async function POST(request: Request): Promise<Response> {
  // Require the authenticated owner before issuing an upload token. Mirrors
  // every other /admin mutation in this codebase (verifySession() first).
  // verifySession() redirects on failure; that throw propagates out of this
  // handler uncaught and Next.js turns it into a real redirect response.
  await verifySession();

  // Adapter-blind from here: getBlobUploadAdapter() (./adapter) is the one
  // place that resolves real-vs-stub from E2E_TESTING.
  return getBlobUploadAdapter().handleUploadRequest(request);
}
