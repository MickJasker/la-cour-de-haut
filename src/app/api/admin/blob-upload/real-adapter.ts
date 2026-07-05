import { handleUpload, type HandleUploadBody } from "@vercel/blob/client";
import type { BlobUploadAdapter } from "./adapter";

// Images only, except the documents/ folder (guest documents feature),
// which is PDF-only. Size capped well above any real gîte photo or guest
// PDF. Bump MAX_SIZE_BYTES if the owner ever needs to upload larger
// originals.
const MAX_SIZE_BYTES = 20 * 1024 * 1024; // 20mb — matches the prior proxy/action ceiling (b962e8f)

/**
 * Pure mapping from the blob pathname (as chosen client-side, e.g.
 * `${folder}/${crypto.randomUUID()}-${file.name}`) to the content types
 * allowed for that upload. Every folder is images-only except documents/,
 * which is PDF-only.
 */
export function allowedContentTypesFor(pathname: string): string[] {
  return pathname.startsWith("documents/") ? ["application/pdf"] : ["image/*"];
}

async function handleUploadRequest(request: Request): Promise<Response> {
  const body = (await request.json()) as HandleUploadBody;

  try {
    const jsonResponse = await handleUpload({
      body,
      request,
      onBeforeGenerateToken: async (pathname) => ({
        allowedContentTypes: allowedContentTypesFor(pathname),
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
