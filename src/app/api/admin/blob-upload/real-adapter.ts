import { handleUpload, type HandleUploadBody } from "@vercel/blob/client";
import type { BlobUploadAdapter } from "./adapter";

// Images only; size capped well above any real gîte photo. Bump
// MAX_SIZE_BYTES if the owner ever needs to upload larger originals.
const ALLOWED_CONTENT_TYPES = ["image/*"];
const MAX_SIZE_BYTES = 20 * 1024 * 1024; // 20mb — matches the prior proxy/action ceiling (b962e8f)

async function handleUploadRequest(request: Request): Promise<Response> {
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

/**
 * Real adapter: issues a client token / handles the upload-completed
 * callback via @vercel/blob/client's handleUpload().
 */
export const realBlobUploadAdapter: BlobUploadAdapter = {
  handleUploadRequest,
};
