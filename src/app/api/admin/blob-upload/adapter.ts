import { realBlobUploadAdapter } from "./real-adapter";
import { stubBlobUploadAdapter } from "./stub-adapter";

/**
 * The seam between "issue an upload token / handle the upload" (route.ts)
 * and "how that upload is actually fulfilled." Both the real
 * @vercel/blob/client-backed adapter and the deterministic E2E stub satisfy
 * this interface, so either is unit-testable on its own without going
 * through getBlobUploadAdapter().
 */
export interface BlobUploadAdapter {
  handleUploadRequest(request: Request): Promise<Response>;
}

/**
 * The single E2E_TESTING resolution point for the blob-upload seam — the
 * only place this route checks the env var. See the matching client-side
 * resolution point in src/app/admin/(private)/upload-image-adapter.ts,
 * which uses NEXT_PUBLIC_E2E_TESTING to reach the same decision in the
 * browser.
 */
export function getBlobUploadAdapter(): BlobUploadAdapter {
  return process.env.E2E_TESTING
    ? stubBlobUploadAdapter
    : realBlobUploadAdapter;
}
