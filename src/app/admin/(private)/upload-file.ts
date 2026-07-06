import { getClientUploadAdapter } from "./upload-file-adapter";
import type { AdminUploadFolder } from "./upload-file-adapter";

// Shared by the POI, gallery, and hero forms (issue #98). Uploads a file
// directly from the browser to Vercel Blob via the token route at
// /api/admin/blob-upload, returning only the resulting public URL — the
// server actions never see the file bytes, so they no longer hit the proxy
// body-buffer limit or Vercel Functions' request-body limit.
//
// Adapter-blind: delegates to whichever adapter getClientUploadAdapter()
// resolves (real Vercel Blob, or the deterministic E2E stub — see
// ./upload-file-adapter). This module never branches on the E2E switch
// itself.
export type { AdminUploadFolder };

export async function uploadAdminImage(
  file: File,
  folder: AdminUploadFolder,
): Promise<string> {
  return getClientUploadAdapter().upload(file, folder);
}

// Guest documents feature: same upload seam as uploadAdminImage, fixed to
// the "documents" folder, which real-adapter.ts (server) allowlists for
// application/pdf instead of image/*.
export async function uploadAdminDocument(file: File): Promise<string> {
  return getClientUploadAdapter().upload(file, "documents");
}
