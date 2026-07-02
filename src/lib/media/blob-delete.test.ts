import { describe, it, expect, vi, beforeEach } from "vitest";

const { delMock } = vi.hoisted(() => ({ delMock: vi.fn() }));
vi.mock("@vercel/blob", () => ({ del: delMock }));

import {
  isVercelBlobUrl,
  deleteBlob,
  deleteBlobBestEffort,
  deleteBlobAndRecord,
} from "./blob-delete";

const BLOB_URL = "https://abc123.public.blob.vercel-storage.com/foo.jpg";
const NON_BLOB_URL = "https://picsum.photos/seed/foo/800/600";

beforeEach(() => {
  delMock.mockReset();
  delMock.mockResolvedValue(undefined);
  vi.spyOn(console, "error")
    .mockClear()
    .mockImplementation(() => {});
});

describe("isVercelBlobUrl", () => {
  it("recognizes a Vercel Blob URL by hostname", () => {
    expect(isVercelBlobUrl(BLOB_URL)).toBe(true);
  });

  it("skips non-Blob hosts, e.g. the E2E picsum stub", () => {
    expect(isVercelBlobUrl(NON_BLOB_URL)).toBe(false);
  });

  it("is not fooled by a hostname merely containing the string elsewhere", () => {
    expect(
      isVercelBlobUrl("https://evil.example.com/?x=blob.vercel-storage.com"),
    ).toBe(false);
  });

  it("treats malformed URLs as non-Blob", () => {
    expect(isVercelBlobUrl("not a url")).toBe(false);
  });
});

describe("deleteBlob", () => {
  it("skips non-Blob URLs without calling del()", async () => {
    await deleteBlob(NON_BLOB_URL);
    expect(delMock).not.toHaveBeenCalled();
  });

  it("calls del() for Blob URLs and propagates failures", async () => {
    delMock.mockRejectedValueOnce(new Error("blob storage down"));
    await expect(deleteBlob(BLOB_URL)).rejects.toThrow("blob storage down");
    expect(delMock).toHaveBeenCalledWith(BLOB_URL);
  });
});

describe("deleteBlobBestEffort", () => {
  it("swallows a blob delete failure and does not throw (replace context)", async () => {
    delMock.mockRejectedValueOnce(new Error("blob storage down"));
    await expect(deleteBlobBestEffort(BLOB_URL)).resolves.toBeUndefined();
    expect(console.error).toHaveBeenCalled();
  });

  it("skips non-Blob URLs without calling del()", async () => {
    await deleteBlobBestEffort(NON_BLOB_URL);
    expect(delMock).not.toHaveBeenCalled();
  });

  it("succeeds silently when the delete succeeds", async () => {
    delMock.mockResolvedValueOnce(undefined);
    await expect(deleteBlobBestEffort(BLOB_URL)).resolves.toBeUndefined();
    expect(console.error).not.toHaveBeenCalled();
  });
});

describe("deleteBlobAndRecord", () => {
  it("deletes the blob then the record on the happy path", async () => {
    delMock.mockResolvedValueOnce(undefined);
    const deleteRecord = vi.fn().mockResolvedValueOnce(undefined);

    await deleteBlobAndRecord(BLOB_URL, deleteRecord, {
      entityLabel: "Gallery image",
      id: "img-1",
    });

    expect(delMock).toHaveBeenCalledWith(BLOB_URL);
    expect(deleteRecord).toHaveBeenCalledTimes(1);
  });

  it("skips the blob delete for a non-Blob URL but still deletes the record", async () => {
    const deleteRecord = vi.fn().mockResolvedValueOnce(undefined);

    await deleteBlobAndRecord(NON_BLOB_URL, deleteRecord, {
      entityLabel: "Gallery image",
      id: "img-1",
    });

    expect(delMock).not.toHaveBeenCalled();
    expect(deleteRecord).toHaveBeenCalledTimes(1);
  });

  it("propagates a blob delete failure without touching the record", async () => {
    delMock.mockRejectedValueOnce(new Error("blob storage down"));
    const deleteRecord = vi.fn();

    await expect(
      deleteBlobAndRecord(BLOB_URL, deleteRecord, {
        entityLabel: "Gallery image",
        id: "img-1",
      }),
    ).rejects.toThrow("blob storage down");
    expect(deleteRecord).not.toHaveBeenCalled();
  });

  it("wraps a DB failure after a successful blob delete in a descriptive error", async () => {
    delMock.mockResolvedValueOnce(undefined);
    const dbError = new Error("connection reset");
    const deleteRecord = vi.fn().mockRejectedValueOnce(dbError);

    let caught: unknown;
    try {
      await deleteBlobAndRecord(BLOB_URL, deleteRecord, {
        entityLabel: "Gallery image",
        id: "img-1",
      });
    } catch (error) {
      caught = error;
    }

    expect(caught).toBeInstanceOf(Error);
    expect((caught as Error).message).toBe(
      "Gallery image blob was deleted from storage but the database record (id=img-1) could not be removed. Please delete the DB row manually.",
    );
    expect((caught as Error).cause).toBe(dbError);
  });
});
