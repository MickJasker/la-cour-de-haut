import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const mockSend = vi.fn();
const MockResend = vi.fn().mockImplementation(function (this: {
  emails: { send: typeof mockSend };
}) {
  this.emails = { send: mockSend };
});

vi.mock("resend", () => ({ Resend: MockResend }));

const { sendBalanceReceivedEmail } = await import("./balance-received-email");

const baseParams = {
  guest: { name: "Anna Schmidt", email: "anna@example.com" },
  startDate: "2027-09-01",
  endDate: "2027-09-07",
  locale: "en",
  totalPaid: 833,
  securityDeposit: 200,
};

describe("sendBalanceReceivedEmail", () => {
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
    await expect(sendBalanceReceivedEmail(baseParams)).rejects.toThrow(
      /RESEND_API_KEY/,
    );
    expect(mockSend).not.toHaveBeenCalled();
  });

  it("uses a deterministic no-op stub under E2E_TESTING, even without a configured key", async () => {
    process.env.E2E_TESTING = "1";

    await expect(sendBalanceReceivedEmail(baseParams)).resolves.toBeUndefined();
    expect(mockSend).not.toHaveBeenCalled();
    expect(MockResend).not.toHaveBeenCalled();
  });

  it("sends via Resend, confirming full payment and the arrival date", async () => {
    process.env.RESEND_API_KEY = "re_test_key";

    await sendBalanceReceivedEmail(baseParams);

    expect(MockResend).toHaveBeenCalledWith("re_test_key");
    expect(mockSend).toHaveBeenCalledOnce();
    const call = mockSend.mock.calls[0]![0] as { html: string; to: string };
    expect(call.to).toBe("anna@example.com");
    expect(call.html).toContain("833.00");
    // Arrival date rendered (long-form, en-GB).
    expect(call.html).toContain("1 September 2027");
  });

  it("notes the refundable security deposit within the total when present", async () => {
    process.env.RESEND_API_KEY = "re_test_key";

    await sendBalanceReceivedEmail(baseParams);

    const call = mockSend.mock.calls[0]![0] as { html: string };
    expect(call.html).toContain("200.00");
    expect(call.html).toMatch(/refundable security deposit/i);
  });

  it("omits the borg note when the security deposit is zero", async () => {
    process.env.RESEND_API_KEY = "re_test_key";

    await sendBalanceReceivedEmail({ ...baseParams, securityDeposit: 0 });

    const call = mockSend.mock.calls[0]![0] as { html: string };
    expect(call.html).not.toMatch(/refundable security deposit/i);
  });

  it("falls back to the English template for an unknown locale", async () => {
    process.env.RESEND_API_KEY = "re_test_key";

    await sendBalanceReceivedEmail({ ...baseParams, locale: "xx" });

    const call = mockSend.mock.calls[0]![0] as { subject: string };
    expect(call.subject).toMatch(/payment/i);
  });

  it.each([
    ["nl", "1 september 2027"],
    ["en", "1 September 2027"],
    ["fr", "1 septembre 2027"],
    ["de", "1. September 2027"],
  ])("renders the arrival date per locale %s", async (locale, expectedDate) => {
    process.env.RESEND_API_KEY = "re_test_key";

    await sendBalanceReceivedEmail({ ...baseParams, locale });

    const call = mockSend.mock.calls[0]![0] as { html: string };
    expect(call.html).toContain(expectedDate);
  });
});
