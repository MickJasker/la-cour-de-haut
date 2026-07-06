import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const mockSend = vi.fn();
const MockResend = vi.fn().mockImplementation(function (this: {
  emails: { send: typeof mockSend };
}) {
  this.emails = { send: mockSend };
});

vi.mock("resend", () => ({ Resend: MockResend }));

const { sendBankTransferEmail } = await import("./bank-transfer-email");

const baseParams = {
  guest: { name: "Anna Schmidt", email: "anna@example.com" },
  startDate: "2027-09-01",
  endDate: "2027-09-07",
  guestCount: 2,
  paymentDeadline: "2027-08-25",
  locale: "en",
  price: { nights: 6, discount: 0, totalPrice: 633 },
  bankDetails: {
    iban: "NL91ABNA0417164300",
    bankName: "Test Bank",
    accountHolder: "La Cour de Haut",
  },
};

describe("sendBankTransferEmail", () => {
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
    await expect(sendBankTransferEmail(baseParams)).rejects.toThrow(
      /RESEND_API_KEY/,
    );
    expect(mockSend).not.toHaveBeenCalled();
  });

  it("uses a deterministic no-op stub under E2E_TESTING, even without a configured key", async () => {
    process.env.E2E_TESTING = "1";

    await expect(sendBankTransferEmail(baseParams)).resolves.toBeUndefined();
    expect(mockSend).not.toHaveBeenCalled();
    expect(MockResend).not.toHaveBeenCalled();
  });

  it("sends via Resend, rendering the amount from the passed-in price snapshot, not settings", async () => {
    process.env.RESEND_API_KEY = "re_test_key";

    await sendBankTransferEmail(baseParams);

    expect(MockResend).toHaveBeenCalledWith("re_test_key");
    expect(mockSend).toHaveBeenCalledOnce();
    const call = mockSend.mock.calls[0]![0] as { html: string; to: string };
    expect(call.to).toBe("anna@example.com");
    // Amount rendered comes from price.totalPrice, no live settings lookup
    // ever happens inside this module.
    expect(call.html).toContain("633");
    // Bank details rendered come from the passed-in bankDetails.
    expect(call.html).toContain("NL91ABNA0417164300");
    expect(call.html).toContain("Test Bank");
    expect(call.html).toContain("La Cour de Haut");
  });

  it("falls back to the English template for an unknown locale", async () => {
    process.env.RESEND_API_KEY = "re_test_key";

    await sendBankTransferEmail({ ...baseParams, locale: "xx" });

    const call = mockSend.mock.calls[0]![0] as { subject: string };
    expect(call.subject).toBe("Your reservation at La Cour de Haut");
  });

  describe("terms link", () => {
    const originalAppUrl = process.env.NEXT_PUBLIC_APP_URL;

    beforeEach(() => {
      process.env.RESEND_API_KEY = "re_test_key";
      delete process.env.NEXT_PUBLIC_APP_URL;
    });

    afterEach(() => {
      if (originalAppUrl === undefined) delete process.env.NEXT_PUBLIC_APP_URL;
      else process.env.NEXT_PUBLIC_APP_URL = originalAppUrl;
    });

    it.each([
      ["nl", "https://lacourdehaut.fr/nl/terms"],
      ["en", "https://lacourdehaut.fr/en/terms"],
      ["fr", "https://lacourdehaut.fr/fr/terms"],
      ["de", "https://lacourdehaut.fr/de/terms"],
    ])(
      "includes the locale-prefixed terms link for locale %s",
      async (locale, expectedUrl) => {
        await sendBankTransferEmail({ ...baseParams, locale });

        const call = mockSend.mock.calls[0]![0] as { html: string };
        expect(call.html).toContain(`href="${expectedUrl}"`);
      },
    );

    it("falls back to the English terms link for an unknown locale, not the raw locale", async () => {
      await sendBankTransferEmail({ ...baseParams, locale: "xx" });

      const call = mockSend.mock.calls[0]![0] as { html: string };
      expect(call.html).toContain(`href="https://lacourdehaut.fr/en/terms"`);
    });

    it("builds the terms URL from NEXT_PUBLIC_APP_URL when configured", async () => {
      process.env.NEXT_PUBLIC_APP_URL = "https://example.com";

      await sendBankTransferEmail({ ...baseParams, locale: "nl" });

      const call = mockSend.mock.calls[0]![0] as { html: string };
      expect(call.html).toContain(`href="https://example.com/nl/terms"`);
    });
  });
});
