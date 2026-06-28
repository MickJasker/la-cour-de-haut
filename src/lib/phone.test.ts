import { describe, it, expect } from "vitest";
import {
  composePhone,
  detectCountry,
  getDialCodeOptions,
  parsePhone,
} from "./phone";

describe("getDialCodeOptions", () => {
  it("includes France with a +33 dial code", () => {
    const options = getDialCodeOptions("en");
    const fr = options.find((o) => o.code === "FR");
    expect(fr?.dialCode).toBe("+33");
  });
});

describe("composePhone", () => {
  it("returns an empty string when no local number is entered", () => {
    // A preselected country must never serialize to a bare dial code like "+33".
    expect(composePhone("FR", "")).toBe("");
    expect(composePhone("FR", "   ")).toBe("");
  });

  it("drops the French national trunk 0 and formats to E.164", () => {
    expect(composePhone("FR", "0612345678")).toBe("+33612345678");
    expect(composePhone("FR", "06 12 34 56 78")).toBe("+33612345678");
  });

  it("keeps the Italian leading 0 (its numbering plan retains it)", () => {
    // The FR-vs-IT contrast is exactly why we can't just "strip a leading 0".
    expect(composePhone("IT", "06 6988 6381")).toBe("+390669886381");
  });

  it("parses a pasted +international number, overriding the selected country", () => {
    expect(composePhone("FR", "+32 470 12 34 56")).toBe("+32470123456");
  });

  it("tolerates surrounding whitespace on a pasted international number", () => {
    expect(composePhone("FR", "  +32 470 12 34 56  ")).toBe("+32470123456");
  });

  it("composes a US national number", () => {
    expect(composePhone("US", "201 555 0123")).toBe("+12015550123");
  });

  it("treats a leading 00 as an international prefix", () => {
    expect(composePhone("FR", "0033612345678")).toBe("+33612345678");
  });

  it("returns an empty string for non-numeric junk", () => {
    expect(composePhone("FR", "abc")).toBe("");
  });
});

describe("detectCountry", () => {
  it("detects the country of a pasted +international number", () => {
    expect(detectCountry("+32 470 12 34 56")).toBe("BE");
  });

  it("returns undefined for a national-format number (no +)", () => {
    expect(detectCountry("0612345678")).toBeUndefined();
  });

  it("ignores surrounding whitespace around a pasted number", () => {
    expect(detectCountry("  +32 470 12 34 56  ")).toBe("BE");
  });
});

describe("parsePhone", () => {
  it("splits a stored E.164 value into its country and national number", () => {
    expect(parsePhone("+33612345678", "NL")).toEqual({
      country: "FR",
      national: "612345678",
    });
  });

  it("falls back to the given country for an empty value", () => {
    expect(parsePhone("", "NL")).toEqual({ country: "NL", national: "" });
  });

  it("does not echo a +-prefixed value into the national field when unparseable", () => {
    // Latent re-hydration safety: never surface a raw "+..." in the local input.
    expect(parsePhone("+99912345", "NL")).toEqual({
      country: "NL",
      national: "",
    });
  });
});
