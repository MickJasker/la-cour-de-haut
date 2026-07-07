import "server-only";
import { Resend } from "resend";
import { getBaseUrl } from "@/lib/base-url";
import type { PaymentSchedule } from "./payment-schedule";

const esc = (s: string) =>
  s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

export type BankDetails = {
  iban: string;
  bankName: string;
  accountHolder: string;
};

/**
 * The balance leg of a two-stage schedule (ADR-0021) — the only shape this
 * email ever renders. `mark_deposit_paid` only reaches a booking with a
 * two-stage snapshot (the collapsed path goes on_hold → confirmed directly
 * via `mark_paid`), so the caller (`lifecycle.ts`) narrows
 * `bookingPaymentSchedule`'s result before calling this, never passing the
 * collapsed variant.
 */
type BalanceLeg = Pick<
  Extract<PaymentSchedule, { collapsed: false }>,
  "balanceAmount" | "balanceDeadline"
>;

type EmailParams = {
  guest: { name: string; email: string };
  startDate: string;
  endDate: string;
  locale: string;
  /** The remaining balance (incl. borg) + its deadline, from the frozen schedule. */
  schedule: BalanceLeg;
  /** The borg (security deposit), included in the balance amount. */
  securityDeposit: number;
  bankDetails: BankDetails;
};

type Copy = {
  intl: string;
  subject: string;
  greeting: (name: string) => string;
  intro: string;
  checkIn: string;
  checkOut: string;
  accountHolder: string;
  iban: string;
  bank: string;
  reference: string;
  amount: string;
  dueBy: string;
  balanceHeading: string;
  balanceRef: string;
  /** "(of which € X is a refundable deposit)". */
  borgNote: (borg: string) => string;
  balanceNote: string;
  termsNote: (url: string) => string;
  signoff: string;
};

const COPY: Record<string, Copy> = {
  nl: {
    intl: "nl-NL",
    subject: "Aanbetaling ontvangen — uw boeking bij La Cour de Haut",
    greeting: (name) => `Beste ${name},`,
    intro:
      "Wij hebben uw aanbetaling ontvangen. Uw datums bij <strong>La Cour de Haut</strong> zijn hiermee definitief gereserveerd:",
    checkIn: "Aankomst",
    checkOut: "Vertrek",
    accountHolder: "Rekeninghouder",
    iban: "IBAN",
    bank: "Bank",
    reference: "Betalingskenmerk",
    amount: "Bedrag",
    dueBy: "Te voldoen vóór",
    balanceHeading: "Restbetaling (incl. borg)",
    balanceRef: "restbetaling",
    borgNote: (borg) => `waarvan ${borg} borg (na het verblijf terugbetaald)`,
    balanceNote:
      "Gelieve de restbetaling over te maken naar onderstaande rekening, met het vermelde betalingskenmerk, zodat u dit ook vanuit deze e-mail kunt regelen.",
    termsNote: (url) =>
      `Op uw reservering zijn onze <a href="${url}">algemene voorwaarden</a> van toepassing.`,
    signoff: "Met vriendelijke groeten,<br/>La Cour de Haut",
  },
  en: {
    intl: "en-GB",
    subject: "Deposit received — your stay at La Cour de Haut",
    greeting: (name) => `Dear ${name},`,
    intro:
      "We've received your deposit. Your dates at <strong>La Cour de Haut</strong> are now secured:",
    checkIn: "Check-in",
    checkOut: "Check-out",
    accountHolder: "Account holder",
    iban: "IBAN",
    bank: "Bank",
    reference: "Reference",
    amount: "Amount",
    dueBy: "Due by",
    balanceHeading: "Balance (incl. security deposit)",
    balanceRef: "balance",
    borgNote: (borg) =>
      `of which ${borg} is a refundable security deposit (returned after your stay)`,
    balanceNote:
      "Please transfer the balance to the account below, quoting the reference shown, so you can settle it straight from this email.",
    termsNote: (url) =>
      `Your reservation is subject to our <a href="${url}">terms and conditions</a>.`,
    signoff: "Kind regards,<br/>La Cour de Haut",
  },
  fr: {
    intl: "fr-FR",
    subject: "Acompte reçu — votre séjour à La Cour de Haut",
    greeting: (name) => `Cher(e) ${name},`,
    intro:
      "Nous avons bien reçu votre acompte. Vos dates à <strong>La Cour de Haut</strong> sont désormais confirmées :",
    checkIn: "Arrivée",
    checkOut: "Départ",
    accountHolder: "Titulaire du compte",
    iban: "IBAN",
    bank: "Banque",
    reference: "Référence",
    amount: "Montant",
    dueBy: "À régler avant le",
    balanceHeading: "Solde (caution incluse)",
    balanceRef: "solde",
    borgNote: (borg) =>
      `dont ${borg} de caution (restituée après votre séjour)`,
    balanceNote:
      "Veuillez virer le solde sur le compte ci-dessous, en indiquant la référence indiquée, afin de le régler directement depuis cet e-mail.",
    termsNote: (url) =>
      `Votre réservation est soumise à nos <a href="${url}">conditions générales</a>.`,
    signoff: "Cordialement,<br/>La Cour de Haut",
  },
  de: {
    intl: "de-DE",
    subject: "Anzahlung erhalten — Ihre Reservierung bei La Cour de Haut",
    greeting: (name) => `Liebe(r) ${name},`,
    intro:
      "Wir haben Ihre Anzahlung erhalten. Ihre Daten bei <strong>La Cour de Haut</strong> sind nun gesichert:",
    checkIn: "Anreise",
    checkOut: "Abreise",
    accountHolder: "Kontoinhaber",
    iban: "IBAN",
    bank: "Bank",
    reference: "Verwendungszweck",
    amount: "Betrag",
    dueBy: "Zu zahlen bis",
    balanceHeading: "Restzahlung (inkl. Kaution)",
    balanceRef: "Restzahlung",
    borgNote: (borg) =>
      `davon ${borg} Kaution (nach Ihrem Aufenthalt zurückerstattet)`,
    balanceNote:
      "Bitte überweisen Sie die Restzahlung auf das untenstehende Konto unter Angabe des genannten Verwendungszwecks — Sie können dies direkt anhand dieser E-Mail erledigen.",
    termsNote: (url) =>
      `Für Ihre Reservierung gelten unsere <a href="${url}">Allgemeinen Geschäftsbedingungen</a>.`,
    signoff: "Mit freundlichen Grüßen,<br/>La Cour de Haut",
  },
};

function row(label: string, value: string): string {
  return `<tr><th align="left">${label}</th><td>${value}</td></tr>`;
}

function renderTemplate(p: EmailParams, c: Copy) {
  const fmtCurrency = (n: number) =>
    new Intl.NumberFormat(c.intl, {
      style: "currency",
      currency: "EUR",
    }).format(n);
  const dateFormatter = new Intl.DateTimeFormat(c.intl, {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
  const fmtDate = (iso: string) => dateFormatter.format(new Date(iso));

  const termsUrl = `${getBaseUrl()}/${c.intl.slice(0, 2)}/terms`;
  const reference = `${p.guest.name} - ${p.startDate} - ${c.balanceRef}`;
  const borg = p.securityDeposit;
  const borgNote = borg > 0 ? c.borgNote(fmtCurrency(borg)) : null;

  const summary = `
      <table cellpadding="6" style="border-collapse:collapse">
        ${row(c.checkIn, fmtDate(p.startDate))}
        ${row(c.checkOut, fmtDate(p.endDate))}
      </table>`;

  const balanceTable = `
      <h3 style="margin-bottom:4px">${c.balanceHeading}</h3>
      <table cellpadding="6" style="border-collapse:collapse">
        ${row(c.amount, `<strong>${fmtCurrency(p.schedule.balanceAmount)}</strong>${borgNote ? ` <em>— ${esc(borgNote)}</em>` : ""}`)}
        ${row(c.dueBy, `<strong>${fmtDate(p.schedule.balanceDeadline)}</strong>`)}
        ${row(c.accountHolder, esc(p.bankDetails.accountHolder))}
        ${row(c.iban, esc(p.bankDetails.iban))}
        ${row(c.bank, esc(p.bankDetails.bankName))}
        ${row(c.reference, esc(reference))}
      </table>`;

  return {
    subject: c.subject,
    html: `
      <h2>${esc(c.greeting(p.guest.name))}</h2>
      <p>${c.intro}</p>
      ${summary}
      ${balanceTable}
      <p>${c.balanceNote}</p>
      <p>${c.termsNote(termsUrl)}</p>
      <p>${c.signoff}</p>`,
  };
}

/**
 * Sends the deposit-received receipt. `applyTransition` is the only caller
 * and treats any rejection as a compensating-rollback trigger (same policy
 * as `sendBankTransferEmail`) — a `mark_deposit_paid` must never report
 * success without the receipt actually going out.
 */
export async function sendDepositReceivedEmail(
  params: EmailParams,
): Promise<void> {
  if (process.env.E2E_TESTING) {
    return;
  }

  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    throw new Error(
      "RESEND_API_KEY is not configured; cannot send the deposit-received email",
    );
  }
  const from = process.env.RESEND_FROM ?? "noreply@lacourdehaut.fr";

  const copy = COPY[params.locale] ?? COPY.en!;
  const { subject, html } = renderTemplate(params, copy);

  const resend = new Resend(apiKey);
  await resend.emails.send({
    from,
    to: params.guest.email,
    subject,
    html,
  });
}
