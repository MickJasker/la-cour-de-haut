import type { BlobUploadAdapter } from "./adapter";

/**
 * Deterministic E2E stand-in for the real token route, resolved by
 * getBlobUploadAdapter() (./adapter) whenever E2E_TESTING is set.
 * Playwright's `upload()` (browser → real Vercel Blob) would otherwise need
 * real BLOB_READ_WRITE_TOKEN-backed network access from the test browser
 * and would leave orphaned blobs behind on every run (the e2e specs
 * truncate tables directly, bypassing del()). Instead, the client helper
 * (upload-image-stub-adapter.ts) skips @vercel/blob/client entirely in this
 * mode and POSTs the file here as multipart/form-data; we hand back a
 * fixed, already next/image-allowlisted picsum.photos URL — same
 * deterministic-stub pattern as src/lib/translate-stub-adapter.ts.
 */
async function handleUploadRequest(request: Request): Promise<Response> {
  const formData = await request.formData();
  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return Response.json({ error: "No file provided" }, { status: 400 });
  }
  return Response.json({
    url: `https://picsum.photos/seed/e2e-${crypto.randomUUID()}/800/600`,
  });
}

export const stubBlobUploadAdapter: BlobUploadAdapter = {
  handleUploadRequest,
};
