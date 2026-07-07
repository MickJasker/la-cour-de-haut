import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const mockSend = vi.fn();
const MockResend = vi.fn().mockImplementation(function (this: {
  emails: { send: typeof mockSend };
}) {
  this.emails = { send: mockSend };
});

vi.mock("resend", () => ({ Resend: MockResend }));

const { sendDepositReceivedEmail } = await import("./deposit-received-email");

const baseParams = {
  guest: { name: "Anna Schmidt", email: "anna@example.com" },
  startDate: "2027-09-01",
  endDate: "2027-09-07",
  locale: "en",
  schedule: {
    balanceAmount: 516.5,
    balanceDeadline: "2027-08-25",
  },
  securityDeposit: 200,
  bankDetails: {
    iban: "NL91ABNA0417164300",
    bankName: "Test Bank",
    accountHolder: "La Cour de Haut",
  },
};

describe("sendDepositReceivedEmail", () => {
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
    await expect(sendDepositReceivedEmail(baseParams)).rejects.toThrow(
      /RESEND_API_KEY/,
    );
    expect(mockSend).not.toHaveBeenCalled();
  });

  it("uses a deterministic no-op stub under E2E_TESTING, even without a configured key", async () => {
    process.env.E2E_TESTING = "1";

    await expect(sendDepositReceivedEmail(baseParams)).resolves.toBeUndefined();
    expect(mockSend).not.toHaveBeenCalled();
    expect(MockResend).not.toHaveBeenCalled();
  });

  it("sends via Resend, rendering the remaining balance and its deadline", async () => {
    process.env.RESEND_API_KEY = "re_test_key";

    await sendDepositReceivedEmail(baseParams);

    expect(MockResend).toHaveBeenCalledWith("re_test_key");
    expect(mockSend).toHaveBeenCalledOnce();
    const call = mockSend.mock.calls[0]![0] as { html: string; to: string };
    expect(call.to).toBe("anna@example.com");
    expect(call.html).toContain("516.50");
    // Bank details are repeated so the guest can pay from the same email.
    expect(call.html).toContain("NL91ABNA0417164300");
    expect(call.html).toContain("Test Bank");
    expect(call.html).toContain("La Cour de Haut");
  });

  it("notes the security deposit included in the balance", async () => {
    process.env.RESEND_API_KEY = "re_test_key";

    await sendDepositReceivedEmail(baseParams);

    const call = mockSend.mock.calls[0]![0] as { html: string };
    expect(call.html).toContain("200.00");
    expect(call.html).toMatch(/refundable security deposit/i);
  });

  it("omits the borg note when the security deposit is zero", async () => {
    process.env.RESEND_API_KEY = "re_test_key";

    await sendDepositReceivedEmail({ ...baseParams, securityDeposit: 0 });

    const call = mockSend.mock.calls[0]![0] as { html: string };
    expect(call.html).not.toMatch(/refundable security deposit/i);
  });

  it("uses a distinct balance payment reference", async () => {
    process.env.RESEND_API_KEY = "re_test_key";

    await sendDepositReceivedEmail(baseParams);

    const call = mockSend.mock.calls[0]![0] as { html: string };
    expect(call.html).toContain("Anna Schmidt - 2027-09-01 - balance");
  });

  it("falls back to the English template for an unknown locale", async () => {
    process.env.RESEND_API_KEY = "re_test_key";

    await sendDepositReceivedEmail({ ...baseParams, locale: "xx" });

    const call = mockSend.mock.calls[0]![0] as { subject: string };
    expect(call.subject).toMatch(/deposit/i);
  });

  it.each([
    ["nl", "https://lacourdehaut.fr/nl/terms"],
    ["en", "https://lacourdehaut.fr/en/terms"],
    ["fr", "https://lacourdehaut.fr/fr/terms"],
    ["de", "https://lacourdehaut.fr/de/terms"],
  ])(
    "includes the locale-prefixed terms link for locale %s",
    async (locale, expectedUrl) => {
      process.env.RESEND_API_KEY = "re_test_key";

      await sendDepositReceivedEmail({ ...baseParams, locale });

      const call = mockSend.mock.calls[0]![0] as { html: string };
      expect(call.html).toContain(`href="${expectedUrl}"`);
    },
  );
});
