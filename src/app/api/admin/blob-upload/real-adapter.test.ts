import { describe, it, expect } from "vitest";
import { allowedContentTypesFor } from "./real-adapter";

describe("allowedContentTypesFor", () => {
  it("allows application/pdf for the documents/ folder", () => {
    expect(allowedContentTypesFor("documents/x.pdf")).toEqual([
      "application/pdf",
    ]);
  });

  it("allows image/* for other folders", () => {
    expect(allowedContentTypesFor("gallery/x.jpg")).toEqual(["image/*"]);
  });

  it("allows image/* for a bare pathname with no folder prefix", () => {
    expect(allowedContentTypesFor("x.pdf")).toEqual(["image/*"]);
  });
});
