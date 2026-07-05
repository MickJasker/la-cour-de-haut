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
 *
 * PDF uploads (guest documents feature) are the exception: there's no
 * meaningful "allowlisted PDF" placeholder equivalent to picsum.photos, and
 * e2e specs that verify a document's contents need the actual bytes back.
 * We already have them here (this route is the one place server-side that
 * sees the raw File, unlike real-adapter.ts's token-only handleUpload()
 * flow), so we echo them back as a data: URL instead.
 */
async function handleUploadRequest(request: Request): Promise<Response> {
  const formData = await request.formData();
  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return Response.json({ error: "No file provided" }, { status: 400 });
  }
  if (file.type === "application/pdf") {
    const base64 = Buffer.from(await file.arrayBuffer()).toString("base64");
    return Response.json({ url: `data:application/pdf;base64,${base64}` });
  }
  return Response.json({
    url: `https://picsum.photos/seed/e2e-${crypto.randomUUID()}/800/600`,
  });
}

export const stubBlobUploadAdapter: BlobUploadAdapter = {
  handleUploadRequest,
};
