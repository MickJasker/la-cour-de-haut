import { describe, it, expect, afterEach } from "vitest";
import { getBlobUploadAdapter } from "./adapter";
import { realBlobUploadAdapter } from "./real-adapter";
import { stubBlobUploadAdapter } from "./stub-adapter";

describe("getBlobUploadAdapter", () => {
  afterEach(() => {
    delete process.env.E2E_TESTING;
  });

  it("resolves the stub adapter under E2E_TESTING", () => {
    process.env.E2E_TESTING = "1";
    expect(getBlobUploadAdapter()).toBe(stubBlobUploadAdapter);
  });

  it("resolves the real adapter otherwise", () => {
    expect(getBlobUploadAdapter()).toBe(realBlobUploadAdapter);
  });
});
