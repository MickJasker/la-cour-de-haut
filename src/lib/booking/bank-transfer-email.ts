import "server-only";
import { Resend } from "resend";
import { getBaseUrl } from "@/lib/base-url";

const esc = (s: string) =>
  s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

/**
 * IBAN etc. — the only piece of the email that legitimately comes from live
 * settings; unlike the price, bank details have no "as of submit time"
 * snapshot on the booking request.
 */
export type BankDetails = {
  iban: string;
  bankName: string;
  accountHolder: string;
};

/**
 * The price, frozen as of the booking request's `shownPriceAtBooking`
 * (submit-time settings), not live settings. Computed once by the caller
 * (`applyTransition`) so this module never reads settings for the amount —
 * it only renders numbers it's handed.
 */
export type PriceSnapshot = {
  nights: number;
  discount: number;
  totalPrice: number;
};

type EmailParams = {
  guest: { name: string; email: string };
  startDate: string;
  endDate: string;
  guestCount: number;
  paymentDeadline: string;
  locale: string;
  price: PriceSnapshot;
  bankDetails: BankDetails;
};

const templates: Record<
  string,
  (p: EmailParams) => { subject: string; html: string }
> = {
  nl: (p) => {
    const currencyFormatter = new Intl.NumberFormat("nl-NL", {
      style: "currency",
      currency: "EUR",
    });
    const { nights, discount, totalPrice } = p.price;

    const dateFormatter = new Intl.DateTimeFormat("nl-NL", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
    const termsUrl = `${getBaseUrl()}/nl/terms`;

    return {
      subject: `Uw reservering bij La Cour de Haut`,
      html: `
      <h2>Beste ${esc(p.guest.name)},</h2>
      <p>Bedankt voor uw boeking bij <strong>La Cour de Haut</strong>. Wij hebben de volgende datums voor u gereserveerd:</p>
      <table cellpadding="6" style="border-collapse:collapse">
        <tr><th align="left">Aankomst</th><td>${dateFormatter.format(new Date(p.startDate))}</td></tr>
        <tr><th align="left">Vertrek</th><td>${dateFormatter.format(new Date(p.endDate))}</td></tr>
        <tr><th align="left">Gasten</th><td>${p.guestCount}</td></tr>
        <tr><th align="left">Aantal nachten</th><td>${nights}</td></tr>
        ${discount > 0 ? `<tr><th align="left">10% korting (7+ nachten)</th><td>−${currencyFormatter.format(discount)}</td></tr>` : ""}
        <tr><th align="left">Totale prijs</th><td>${currencyFormatter.format(totalPrice)}</td></tr>
      </table>
      <p>Om uw reservering definitief te maken, verzoeken wij u het verschuldigde bedrag vóór <strong>${esc(p.paymentDeadline)}</strong> over te maken naar:</p>
      <table cellpadding="6" style="border-collapse:collapse">
        <tr><th align="left">Rekeninghouder</th><td>${esc(p.bankDetails.accountHolder)}</td></tr>
        <tr><th align="left">IBAN</th><td>${esc(p.bankDetails.iban)}</td></tr>
        <tr><th align="left">Bank</th><td>${esc(p.bankDetails.bankName)}</td></tr>
        <tr><th align="left">Betalingskenmerk</th><td>${esc(p.guest.name)} - ${esc(p.startDate)}</td></tr>
      </table>
      <p>Als wij uw betaling niet ontvangen vóór de betalingstermijn, vervalt de reservering automatisch.</p>
      <p>Op uw reservering zijn onze <a href="${termsUrl}">algemene voorwaarden</a> van toepassing.</p>
      <p>Met vriendelijke groeten,<br/>La Cour de Haut</p>`,
    };
  },

  en: (p) => {
    const currencyFormatter = new Intl.NumberFormat("en-GB", {
      style: "currency",
      currency: "EUR",
    });
    const { nights, discount, totalPrice } = p.price;

    const dateFormatter = new Intl.DateTimeFormat("en-GB", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
    const termsUrl = `${getBaseUrl()}/en/terms`;

    return {
      subject: `Your reservation at La Cour de Haut`,
      html: `
      <h2>Dear ${esc(p.guest.name)},</h2>
      <p>Thank you for your booking at <strong>La Cour de Haut</strong>. We have reserved the following dates for you:</p>
      <table cellpadding="6" style="border-collapse:collapse">
        <tr><th align="left">Check-in</th><td>${dateFormatter.format(new Date(p.startDate))}</td></tr>
        <tr><th align="left">Check-out</th><td>${dateFormatter.format(new Date(p.endDate))}</td></tr>
        <tr><th align="left">Guests</th><td>${p.guestCount}</td></tr>
        <tr><th align="left">Total nights</th><td>${nights}</td></tr>
        ${discount > 0 ? `<tr><th align="left">10% long-stay discount (7+ nights)</th><td>−${currencyFormatter.format(discount)}</td></tr>` : ""}
        <tr><th align="left">Total price</th><td>${currencyFormatter.format(totalPrice)}</td></tr>
      </table>
      <p>To confirm your reservation, please transfer the agreed amount before <strong>${esc(p.paymentDeadline)}</strong> to:</p>
      <table cellpadding="6" style="border-collapse:collapse">
        <tr><th align="left">Account holder</th><td>${esc(p.bankDetails.accountHolder)}</td></tr>
        <tr><th align="left">IBAN</th><td>${esc(p.bankDetails.iban)}</td></tr>
        <tr><th align="left">Bank</th><td>${esc(p.bankDetails.bankName)}</td></tr>
        <tr><th align="left">Reference</th><td>${esc(p.guest.name)} - ${esc(p.startDate)}</td></tr>
      </table>
      <p>If payment is not received before the deadline, your reservation will be released.</p>
      <p>Your reservation is subject to our <a href="${termsUrl}">terms and conditions</a>.</p>
      <p>Kind regards,<br/>La Cour de Haut</p>`,
    };
  },

  fr: (p) => {
    const currencyFormatter = new Intl.NumberFormat("fr-FR", {
      style: "currency",
      currency: "EUR",
    });
    const dateFormatter = new Intl.DateTimeFormat("fr-FR", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
    const { discount, totalPrice } = p.price;
    const termsUrl = `${getBaseUrl()}/fr/terms`;

    return {
      subject: `Votre réservation à La Cour de Haut`,
      html: `
        <h2>Cher(e) ${esc(p.guest.name)},</h2>
        <p>Merci pour votre réservation à <strong>La Cour de Haut</strong>. Nous avons réservé les dates suivantes pour vous :</p>
        <table cellpadding="6" style="border-collapse:collapse">
        <tr><th align="left">Arrivée</th><td>${dateFormatter.format(new Date(p.startDate))}</td></tr>
        <tr><th align="left">Départ</th><td>${dateFormatter.format(new Date(p.endDate))}</td></tr>
        <tr><th align="left">Voyageurs</th><td>${p.guestCount}</td></tr>
        ${discount > 0 ? `<tr><th align="left">Réduction long séjour 10% (7+ nuits)</th><td>−${currencyFormatter.format(discount)}</td></tr>` : ""}
        <tr><th align="left">Prix total</th><td>${currencyFormatter.format(totalPrice)}</td></tr>
      </table>
      <p>Pour confirmer votre réservation, veuillez virer le montant convenu avant le <strong>${esc(p.paymentDeadline)}</strong> à :</p>
      <table cellpadding="6" style="border-collapse:collapse">
        <tr><th align="left">Titulaire du compte</th><td>${esc(p.bankDetails.accountHolder)}</td></tr>
        <tr><th align="left">IBAN</th><td>${esc(p.bankDetails.iban)}</td></tr>
        <tr><th align="left">Banque</th><td>${esc(p.bankDetails.bankName)}</td></tr>
        <tr><th align="left">Référence</th><td>${esc(p.guest.name)} - ${esc(p.startDate)}</td></tr>
      </table>
      <p>Si le paiement n'est pas reçu avant la date limite, la réservation sera automatiquement annulée.</p>
      <p>Votre réservation est soumise à nos <a href="${termsUrl}">conditions générales</a>.</p>
      <p>Cordialement,<br/>La Cour de Haut</p>`,
    };
  },

  de: (p) => {
    const currencyFormatter = new Intl.NumberFormat("de-DE", {
      style: "currency",
      currency: "EUR",
    });
    const { nights, discount, totalPrice } = p.price;
    const dateFormatter = new Intl.DateTimeFormat("de-DE", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
    const termsUrl = `${getBaseUrl()}/de/terms`;

    return {
      subject: `Ihre Reservierung bei La Cour de Haut`,
      html: `
      <h2>Liebe(r) ${esc(p.guest.name)},</h2>
      <p>Vielen Dank für Ihre Buchung bei <strong>La Cour de Haut</strong>. Wir haben die folgenden Daten für Sie reserviert:</p>
      <table cellpadding="6" style="border-collapse:collapse">
        <tr><th align="left">Anreise</th><td>${dateFormatter.format(new Date(p.startDate))}</td></tr>
        <tr><th align="left">Abreise</th><td>${dateFormatter.format(new Date(p.endDate))}</td></tr>
        <tr><th align="left">Gäste</th><td>${p.guestCount}</td></tr>
        <tr><th align="left">Gesamtnächte</th><td>${nights}</td></tr>
        ${discount > 0 ? `<tr><th align="left">10% Langzeitrabatt (7+ Nächte)</th><td>−${currencyFormatter.format(discount)}</td></tr>` : ""}
        <tr><th align="left">Gesamtpreis</th><td>${currencyFormatter.format(totalPrice)}</td></tr>
      </table>
      <p>Um Ihre Reservierung zu bestätigen, bitten wir Sie, den vereinbarten Betrag bis zum <strong>${esc(p.paymentDeadline)}</strong> zu überweisen an:</p>
      <table cellpadding="6" style="border-collapse:collapse">
        <tr><th align="left">Kontoinhaber</th><td>${esc(p.bankDetails.accountHolder)}</td></tr>
        <tr><th align="left">IBAN</th><td>${esc(p.bankDetails.iban)}</td></tr>
        <tr><th align="left">Bank</th><td>${esc(p.bankDetails.bankName)}</td></tr>
        <tr><th align="left">Verwendungszweck</th><td>${esc(p.guest.name)} - ${esc(p.startDate)}</td></tr>
      </table>
      <p>Wenn die Zahlung nicht vor Ablauf der Frist eingeht, wird die Reservierung automatisch storniert.</p>
      <p>Für Ihre Reservierung gelten unsere <a href="${termsUrl}">Allgemeinen Geschäftsbedingungen</a>.</p>
      <p>Mit freundlichen Grüßen,<br/>La Cour de Haut</p>`,
    };
  },
};

/**
 * Sends the bank-transfer instructions email. `applyTransition` is the only
 * caller and treats any rejection as a compensating-rollback trigger, so
 * this function must never resolve successfully without actually sending —
 * an unconfigured transport is a loud failure, not a silent no-op.
 *
 * `E2E_TESTING` selects a deterministic stub explicitly (same switch as
 * `translate.ts`), so the Playwright suite — which runs without a real
 * Resend key — gets predictable "email sent" behavior on purpose, not by
 * falling through an unconfigured-transport branch.
 */
export async function sendBankTransferEmail(
  params: EmailParams,
): Promise<void> {
  if (process.env.E2E_TESTING) {
    return;
  }

  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    throw new Error(
      "RESEND_API_KEY is not configured; cannot send the bank-transfer email",
    );
  }
  const from = process.env.RESEND_FROM ?? "noreply@lacourdehaut.fr";

  const tmpl = templates[params.locale] ?? templates.en!;
  const { subject, html } = tmpl(params);

  const resend = new Resend(apiKey);
  await resend.emails.send({
    from,
    to: params.guest.email,
    subject,
    html,
  });
}
