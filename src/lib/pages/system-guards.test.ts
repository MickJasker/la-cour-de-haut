import { describe, it, expect } from "vitest";
import {
  assertPageDeletable,
  assertPagePublishToggleable,
} from "./system-guards";

describe("system-page guards (ADR-0020)", () => {
  it("refuses deleting a system page", () => {
    expect(() => assertPageDeletable({ system: true })).toThrow(
      "Systeempagina's kunnen niet worden verwijderd",
    );
  });

  it("refuses toggling publication of a system page", () => {
    expect(() => assertPagePublishToggleable({ system: true })).toThrow(
      "Systeempagina's zijn altijd gepubliceerd",
    );
  });

  it("allows both on an owner-created page", () => {
    expect(() => assertPageDeletable({ system: false })).not.toThrow();
    expect(() => assertPagePublishToggleable({ system: false })).not.toThrow();
  });
});
