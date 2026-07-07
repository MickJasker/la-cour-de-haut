import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const mockSend = vi.fn();
const MockResend = vi.fn().mockImplementation(function (this: {
  emails: { send: typeof mockSend };
}) {
  this.emails = { send: mockSend };
});

vi.mock("resend", () => ({ Resend: MockResend }));

const { sendCancellationEmail } = await import("./cancellation-email");

const baseParams = {
  guest: { name: "Anna Schmidt", email: "anna@example.com" },
  startDate: "2027-09-01",
  endDate: "2027-09-07",
  locale: "en",
};

describe("sendCancellationEmail", () => {
  const originalApiKey = process.env.RESEND_API_KEY;
  const originalE2e = process.env.E2E_TESTING;

  beforeEach(() => {
    mockSend.mockClear();
    MockResend.mockClear();
    mockSend.mockResolvedValue({ data: { id: "email-1" } });
    delete process.env.RESEND_API_KEY;
    delete process.env.E2E_TESTING;
  });

  afterEach(() => {
    if (originalApiKey === undefined) delete process.env.RESEND_API_KEY;
    else process.env.RESEND_API_KEY = originalApiKey;
    if (originalE2e === undefined) delete process.env.E2E_TESTING;
    else process.env.E2E_TESTING = originalE2e;
  });

  it("fails loudly when RESEND_API_KEY is not configured (not a silent no-op)", async () => {
    await expect(sendCancellationEmail(baseParams)).rejects.toThrow(
      /RESEND_API_KEY/,
    );
    expect(mockSend).not.toHaveBeenCalled();
  });

  it("uses a deterministic no-op stub under E2E_TESTING, even without a configured key", async () => {
    process.env.E2E_TESTING = "1";

    await expect(sendCancellationEmail(baseParams)).resolves.toBeUndefined();
    expect(mockSend).not.toHaveBeenCalled();
    expect(MockResend).not.toHaveBeenCalled();
  });

  it("sends via Resend, confirming cancellation and the released dates", async () => {
    process.env.RESEND_API_KEY = "re_test_key";

    await sendCancellationEmail(baseParams);

    expect(MockResend).toHaveBeenCalledWith("re_test_key");
    expect(mockSend).toHaveBeenCalledOnce();
    const call = mockSend.mock.calls[0]![0] as { html: string; to: string };
    expect(call.to).toBe("anna@example.com");
    // Arrival date rendered (long-form, en-GB).
    expect(call.html).toContain("1 September 2027");
  });

  it("never mentions refunds, amounts, or bank details — money stays off-platform", async () => {
    process.env.RESEND_API_KEY = "re_test_key";

    await sendCancellationEmail(baseParams);

    const call = mockSend.mock.calls[0]![0] as { html: string };
    expect(call.html).not.toMatch(/refund|iban|bank|€|deposit|borg|caution/i);
  });

  it("falls back to the English template for an unknown locale", async () => {
    process.env.RESEND_API_KEY = "re_test_key";

    await sendCancellationEmail({ ...baseParams, locale: "xx" });

    const call = mockSend.mock.calls[0]![0] as { subject: string };
    expect(call.subject).toMatch(/cancel/i);
  });

  it.each([
    ["nl", "1 september 2027"],
    ["en", "1 September 2027"],
    ["fr", "1 septembre 2027"],
    ["de", "1. September 2027"],
  ])("renders the arrival date per locale %s", async (locale, expectedDate) => {
    process.env.RESEND_API_KEY = "re_test_key";

    await sendCancellationEmail({ ...baseParams, locale });

    const call = mockSend.mock.calls[0]![0] as { html: string };
    expect(call.html).toContain(expectedDate);
  });
});
