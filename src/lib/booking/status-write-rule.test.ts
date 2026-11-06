// @vitest-environment node
import { describe, it, expect } from "vitest";
import { ESLint } from "eslint";

// ADR-0026: only lifecycle.ts may write bookingRequest.status. These lint real
// snippets with the repo's own ESLint config so the rule can't silently rot.
const eslint = new ESLint({ cwd: process.cwd() });

async function lint(code: string, filePath: string) {
  const [result] = await eslint.lintText(code, { filePath });
  return result.messages.filter((m) => m.ruleId === "no-restricted-syntax");
}

const STATUS_WRITE = `
  await db.update(bookingRequest).set({ status: "confirmed" }).where(eq(bookingRequest.id, id));
`;

describe("no direct bookingRequest.status writes (ADR-0026)", () => {
  it("flags a status write outside the lifecycle module", async () => {
    const messages = await lint(STATUS_WRITE, "src/app/admin/rogue.ts");
    expect(messages).toHaveLength(1);
    expect(messages[0].message).toContain("applyTransition");
  });

  it("allows the lifecycle module to write status", async () => {
    expect(await lint(STATUS_WRITE, "src/lib/booking/lifecycle.ts")).toEqual(
      [],
    );
  });

  it("allows other bookingRequest columns", async () => {
    const code = `await db.update(bookingRequest).set({ ownerNotes: "x" }).where(eq(bookingRequest.id, id));`;
    expect(await lint(code, "src/app/admin/notes.ts")).toEqual([]);
  });

  it("ignores status writes on other tables", async () => {
    const code = `await db.update(page).set({ status: "draft" }).where(eq(page.id, id));`;
    expect(await lint(code, "src/app/admin/pages.ts")).toEqual([]);
  });
});
