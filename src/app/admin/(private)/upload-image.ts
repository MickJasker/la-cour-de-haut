import { upload } from "@vercel/blob/client";

// Shared by the POI, gallery, and hero forms (issue #98). Uploads a file
// directly from the browser to Vercel Blob via the token route at
// /api/admin/blob-upload, returning only the resulting public URL — the
// server actions never see the file bytes, so they no longer hit the proxy
// body-buffer limit or Vercel Functions' request-body limit.
//
// In E2E_TESTING, real client uploads are skipped: Playwright doesn't need
// (and shouldn't depend on) real Vercel Blob network access, so the file is
// POSTed same-origin to the token route instead, which short-circuits with a
// fixed, already next/image-allowlisted URL. See the matching branch in
// src/app/api/admin/blob-upload/route.ts.
const isE2E = process.env.NEXT_PUBLIC_E2E_TESTING === "1";

export type AdminImageFolder = "pois" | "gallery" | "content";

export async function uploadAdminImage(
  file: File,
  folder: AdminImageFolder,
): Promise<string> {
  if (isE2E) {
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
