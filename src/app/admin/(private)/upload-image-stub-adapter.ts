import type { ClientUploadAdapter } from "./upload-image-adapter";

/**
 * Deterministic E2E stand-in for the real upload adapter, resolved by
 * getClientUploadAdapter() (./upload-image-adapter) whenever
 * NEXT_PUBLIC_E2E_TESTING is set. Playwright doesn't need (and shouldn't
 * depend on) real Vercel Blob network access, so the file is POSTed
 * same-origin to the token route instead, which short-circuits with a
 * fixed, already next/image-allowlisted URL. See the matching branch in
 * src/app/api/admin/blob-upload/stub-adapter.ts.
 */
async function uploadStub(file: File): Promise<string> {
  const formData = new FormData();
  formData.set("file", file);
  const res = await fetch("/api/admin/blob-upload", {
    method: "POST",
    body: formData,
  });
  if (!res.ok) {
    throw new Error("Afbeelding uploaden mislukt");
  }
  const data = (await res.json()) as { url: string };
  return data.url;
}

export const stubClientUploadAdapter: ClientUploadAdapter = {
  upload: uploadStub,
};
