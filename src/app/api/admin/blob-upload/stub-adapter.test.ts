/**
 * @vitest-environment node
 *
 * This route handler always runs server-side in Node, never under jsdom.
 * Forcing the node environment here matters: jsdom installs its own
 * File/FormData globals that don't round-trip through Request.formData()
 * as `instanceof File`, which would make this test fail for reasons the
 * production code never hits.
 */
import { describe, it, expect } from "vitest";
import { stubBlobUploadAdapter } from "./stub-adapter";

describe("stubBlobUploadAdapter", () => {
  it("returns an allowlisted picsum.photos URL for a valid file", async () => {
    const formData = new FormData();
    formData.set(
      "file",
      new File(["fake-bytes"], "photo.jpg", { type: "image/jpeg" }),
    );
    const request = new Request("http://localhost/api/admin/blob-upload", {
      method: "POST",
      body: formData,
    });

    const response = await stubBlobUploadAdapter.handleUploadRequest(request);

    expect(response.status).toBe(200);
    const body = (await response.json()) as { url: string };
    expect(body.url).toMatch(
      /^https:\/\/picsum\.photos\/seed\/e2e-.+\/800\/600$/,
    );
  });

  it("errors with 400 when no file is provided", async () => {
    const request = new Request("http://localhost/api/admin/blob-upload", {
      method: "POST",
      body: new FormData(),
    });

    const response = await stubBlobUploadAdapter.handleUploadRequest(request);

    expect(response.status).toBe(400);
    const body = (await response.json()) as { error: string };
    expect(body.error).toBe("No file provided");
  });

  it("errors with 400 for an empty file", async () => {
    const formData = new FormData();
    formData.set("file", new File([], "empty.jpg", { type: "image/jpeg" }));
    const request = new Request("http://localhost/api/admin/blob-upload", {
      method: "POST",
      body: formData,
    });

    const response = await stubBlobUploadAdapter.handleUploadRequest(request);

    expect(response.status).toBe(400);
  });

  it("echoes a PDF upload back as a data: URL with the same bytes", async () => {
    const pdfBytes = new Uint8Array([1, 2, 3, 4, 5, 250, 251, 252]);
    const formData = new FormData();
    formData.set(
      "file",
      new File([pdfBytes], "doc.pdf", { type: "application/pdf" }),
    );
    const request = new Request("http://localhost/api/admin/blob-upload", {
      method: "POST",
      body: formData,
    });

    const response = await stubBlobUploadAdapter.handleUploadRequest(request);

    expect(response.status).toBe(200);
    const body = (await response.json()) as { url: string };
    expect(body.url).toMatch(/^data:application\/pdf;base64,/);
    const base64 = body.url.slice("data:application/pdf;base64,".length);
    const decoded = new Uint8Array(Buffer.from(base64, "base64"));
    expect(Array.from(decoded)).toEqual(Array.from(pdfBytes));
  });
});
