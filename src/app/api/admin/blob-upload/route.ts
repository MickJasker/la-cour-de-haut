import { handleUpload, type HandleUploadBody } from "@vercel/blob/client";
import { verifySession } from "@/lib/dal";

// Token endpoint for client-side direct-to-Blob uploads (see issue #98). The
// browser streams the file straight to Vercel Blob instead of through a
// server action, which avoids both the proxy body-buffer limit
// (proxyClientMaxBodySize, src/proxy.ts) and the Vercel Functions
// request-body limit that a server action's put() would otherwise hit.
//
// Images only; size capped well above any real gîte photo. Bump
// MAX_SIZE_BYTES if the owner ever needs to upload larger originals.
const ALLOWED_CONTENT_TYPES = ["image/*"];
const MAX_SIZE_BYTES = 20 * 1024 * 1024; // 20mb — matches the prior proxy/action ceiling (b962e8f)

export async function POST(request: Request): Promise<Response> {
  // Require the authenticated owner before issuing an upload token. Mirrors
  // every other /admin mutation in this codebase (verifySession() first).
  // verifySession() redirects on failure; that throw propagates out of this
  // handler uncaught and Next.js turns it into a real redirect response.
  await verifySession();

  // E2E_TESTING: Playwright's `upload()` (browser → real Vercel Blob) would
  // otherwise need real BLOB_READ_WRITE_TOKEN-backed network access from the
  // test browser and would leave orphaned blobs behind on every run (the e2e
  // specs truncate tables directly, bypassing del()). Instead, the client
  // helper (upload-image.ts) skips @vercel/blob/client entirely in this mode
  // and POSTs the file here as multipart/form-data; we hand back a fixed,
  // already next/image-allowlisted picsum.photos URL — same deterministic-stub
  // pattern as the E2E_TESTING branch in src/lib/translate.ts.
  if (process.env.E2E_TESTING) {
    const formData = await request.formData();
    const file = formData.get("file");
    if (!(file instanceof File) || file.size === 0) {
      return Response.json({ error: "No file provided" }, { status: 400 });
    }
    return Response.json({
      url: `https://picsum.photos/seed/e2e-${crypto.randomUUID()}/800/600`,
    });
  }

  const body = (await request.json()) as HandleUploadBody;

  try {
    const jsonResponse = await handleUpload({
      body,
      request,
      onBeforeGenerateToken: async () => ({
        allowedContentTypes: ALLOWED_CONTENT_TYPES,
        maximumSizeInBytes: MAX_SIZE_BYTES,
      }),
      // No onUploadCompleted: the client passes the resulting blob.url
      // straight to the relevant server action (createPoiAction,
      // uploadGalleryImageAction, uploadHeroImageAction), which persists it.
      // That callback also requires Vercel to reach this route publicly,
      // which never works from localhost/CI anyway.
    });

    return Response.json(jsonResponse);
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "Upload failed" },
      { status: 400 },
    );
  }
}
