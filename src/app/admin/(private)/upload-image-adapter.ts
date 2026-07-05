import { realClientUploadAdapter } from "./upload-image-real-adapter";
import { stubClientUploadAdapter } from "./upload-image-stub-adapter";

export type AdminImageFolder = "pois" | "gallery" | "content" | "documents";

/**
 * The seam between "upload this file" (uploadAdminImage in
 * ./upload-image.ts) and "how the upload actually reaches storage." Both
 * the real @vercel/blob/client-backed adapter and the deterministic E2E
 * stub satisfy this interface, so either is unit-testable on its own
 * without going through getClientUploadAdapter().
 */
export interface ClientUploadAdapter {
  upload(file: File, folder: AdminImageFolder): Promise<string>;
}

// This module runs client-side (bundled into the browser via the gallery /
// content / POI forms), so the E2E switch has to be a NEXT_PUBLIC_ var
// inlined at build time — process.env.E2E_TESTING (server-only) is not
// available here. See the matching server-side resolution point in
// src/app/api/admin/blob-upload/adapter.ts.
const isE2E = process.env.NEXT_PUBLIC_E2E_TESTING === "1";

/**
 * The single E2E switch resolution point for the client-upload seam — the
 * only place this module reads NEXT_PUBLIC_E2E_TESTING.
 */
export function getClientUploadAdapter(): ClientUploadAdapter {
  return isE2E ? stubClientUploadAdapter : realClientUploadAdapter;
}
