import { describe, it, expect, vi, afterEach } from "vitest";
import { stubClientUploadAdapter } from "./upload-image-stub-adapter";

describe("stubClientUploadAdapter", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("POSTs the file same-origin to the token route and returns the resulting URL", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        url: "https://picsum.photos/seed/e2e-abc/800/600",
      }),
    });
    vi.stubGlobal("fetch", fetchMock);

    const file = new File(["fake-bytes"], "photo.jpg", {
      type: "image/jpeg",
    });
    const url = await stubClientUploadAdapter.upload(file, "gallery");

    expect(url).toBe("https://picsum.photos/seed/e2e-abc/800/600");
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/admin/blob-upload",
      expect.objectContaining({ method: "POST" }),
    );
    const [, options] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(options.body).toBeInstanceOf(FormData);
  });

  it("throws when the token route responds with a non-OK status", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ ok: false } as Response),
    );

    const file = new File(["fake-bytes"], "photo.jpg", {
      type: "image/jpeg",
    });
    await expect(stubClientUploadAdapter.upload(file, "pois")).rejects.toThrow(
      "Afbeelding uploaden mislukt",
    );
  });
});
