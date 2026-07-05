import { upload } from "@vercel/blob/client";
import type {
  AdminUploadFolder,
  ClientUploadAdapter,
} from "./upload-file-adapter";

/**
 * Real adapter: uploads a file directly from the browser to Vercel Blob via
 * the token route at /api/admin/blob-upload, returning only the resulting
 * public URL — the server actions never see the file bytes, so they don't
 * hit the proxy body-buffer limit or Vercel Functions' request-body limit.
 */
async function uploadReal(
  file: File,
  folder: AdminUploadFolder,
): Promise<string> {
  const blob = await upload(
    `${folder}/${crypto.randomUUID()}-${file.name}`,
    file,
    {
      access: "public",
      handleUploadUrl: "/api/admin/blob-upload",
    },
  );
  return blob.url;
}

export const realClientUploadAdapter: ClientUploadAdapter = {
  upload: uploadReal,
};
