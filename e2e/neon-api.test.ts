// @vitest-environment node
import { describe, expect, it, vi } from "vitest";
import { isRetryable, neonRequest, retryDelayMs } from "./neon-api";

const creds = { key: "k", project: "p" };

function response(status: number, body: unknown = {}) {
  return new Response(JSON.stringify(body), { status });
}

function deps(responses: Response[]) {
  const fetchFn = vi.fn(async () => {
    const next = responses.shift();
    if (!next) throw new Error("no more responses");
    return next;
  });
  const sleep = vi.fn(async () => {});
  return { fetch: fetchFn, sleep, random: () => 0.5 };
}

describe("isRetryable", () => {
  it.each([406, 409, 423, 429, 500, 502, 503])("retries %i", (status) => {
    expect(isRetryable(status)).toBe(true);
  });

  it.each([400, 401, 403, 404])("fails fast on %i", (status) => {
    expect(isRetryable(status)).toBe(false);
  });
});

describe("retryDelayMs", () => {
  it("backs off ~5, 10, 20, 40, 40s with random 0.5 (no jitter shift)", () => {
    const delays = [0, 1, 2, 3, 4].map((a) => retryDelayMs(a, () => 0.5));
    expect(delays).toEqual([5000, 10000, 20000, 40000, 40000]);
  });

  it("jitters within ±25% of the base delay", () => {
    expect(retryDelayMs(0, () => 0)).toBe(3750);
    expect(retryDelayMs(0, () => 1)).toBe(6250);
  });
});

describe("neonRequest", () => {
  it("returns the parsed body on success", async () => {
    const d = deps([response(200, { ok: true })]);
    await expect(neonRequest("/branches", {}, creds, d)).resolves.toEqual({
      ok: true,
    });
    expect(d.sleep).not.toHaveBeenCalled();
  });

  it("retries a transient status then succeeds", async () => {
    const d = deps([response(423), response(429), response(200, { ok: 1 })]);
    await expect(neonRequest("/branches", {}, creds, d)).resolves.toEqual({
      ok: 1,
    });
    expect(d.fetch).toHaveBeenCalledTimes(3);
    expect(d.sleep).toHaveBeenCalledTimes(2);
  });

  it("fails fast on a credential error and surfaces the Neon body", async () => {
    const d = deps([response(401, { message: "bad token" })]);
    await expect(neonRequest("/branches", {}, creds, d)).rejects.toThrow(
      /401.*bad token/,
    );
    expect(d.fetch).toHaveBeenCalledTimes(1);
    expect(d.sleep).not.toHaveBeenCalled();
  });

  it("gives up after 5 attempts with the last error body", async () => {
    const d = deps(
      Array.from({ length: 5 }, (_, i) =>
        response(406, { message: `branch limit ${i}` }),
      ),
    );
    await expect(
      neonRequest("/branches", { method: "POST" }, creds, d),
    ).rejects.toThrow(/POST \/branches.*406.*branch limit 4/);
    expect(d.fetch).toHaveBeenCalledTimes(5);
    // No sleep after the final failed attempt.
    expect(d.sleep).toHaveBeenCalledTimes(4);
  });
});
