import { describe, it, expect } from "vitest";
import { isSafeHref } from "./safe-url";

describe("isSafeHref", () => {
  it("allows http, https and mailto", () => {
    expect(isSafeHref("http://example.com")).toBe(true);
    expect(isSafeHref("https://example.com/path?q=1")).toBe(true);
    expect(isSafeHref("mailto:info@lacourdehaut.fr")).toBe(true);
  });

  it("rejects script-bearing and other unsafe schemes", () => {
    expect(isSafeHref("javascript:alert(1)")).toBe(false);
    expect(isSafeHref("data:text/html;base64,PHNjcmlwdD4=")).toBe(false);
    expect(isSafeHref("vbscript:msgbox(1)")).toBe(false);
    expect(isSafeHref("file:///etc/passwd")).toBe(false);
  });

  it("is not fooled by case or leading whitespace", () => {
    expect(isSafeHref("  JavaScript:alert(1)")).toBe(false);
    expect(isSafeHref("HTTPS://example.com")).toBe(true);
  });

  it("treats relative/empty input as safe (it resolves to an http(s) base)", () => {
    // The renderer only feeds author-entered URLs here; relative input is
    // harmless (resolves to https). The guard exists to block dangerous schemes.
    expect(isSafeHref("/poi/bayeux")).toBe(true);
    expect(isSafeHref("")).toBe(true);
  });
});
