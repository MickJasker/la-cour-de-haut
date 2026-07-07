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
 * The rental price, frozen as of the booking request's `shownPriceAtBooking`
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
  locale: string;
  price: PriceSnapshot;
  /** The frozen two-stage (or collapsed) payment schedule, ADR-0021. */
  schedule: PaymentSchedule;
  /** The borg (security deposit), always charged with the final payment. */
  securityDeposit: number;
  bankDetails: BankDetails;
};

/**
 * Per-locale copy for the email. Kept as one table so the four locales stay
 * in lockstep — the render helpers below are locale-agnostic and read every
 * string from here.
 */
type Copy = {
  intl: string;
  subject: string;
  greeting: (name: string) => string;
  intro: string;
  checkIn: string;
  checkOut: string;
  guests: string;
  nights: string;
  discount: string;
  totalPrice: string;
  accountHolder: string;
  iban: string;
  bank: string;
  reference: string;
  amount: string;
  dueBy: string;
  /** Intro line before the schedule tables (two-stage). */
  twoStageIntro: string;
  /** Intro line before the single schedule table (collapsed). */
  collapsedIntro: string;
  depositHeading: string;
  balanceHeading: string;
  singleHeading: string;
  /** Reference suffix distinguishing the two transfers. */
  depositRef: string;
  balanceRef: string;
  /** "(of which € X is a refundable deposit)". */
  borgNote: (borg: string) => string;
  /** Warning that a missed first-payment deadline releases the dates. */
  releaseNote: string;
  /** Note that the balance secures the final confirmation. */
  balanceNote: string;
  termsNote: (url: string) => string;
  signoff: string;
};

const COPY: Record<string, Copy> = {
  nl: {
    intl: "nl-NL",
    subject: "Uw reservering bij La Cour de Haut",
    greeting: (name) => `Beste ${name},`,
    intro:
      "Bedankt voor uw boeking bij <strong>La Cour de Haut</strong>. Wij hebben de volgende datums voor u gereserveerd:",
    checkIn: "Aankomst",
    checkOut: "Vertrek",
    guests: "Gasten",
    nights: "Aantal nachten",
    discount: "10% korting (7+ nachten)",
    totalPrice: "Totale prijs",
    accountHolder: "Rekeninghouder",
    iban: "IBAN",
    bank: "Bank",
    reference: "Betalingskenmerk",
    amount: "Bedrag",
    dueBy: "Te voldoen vóór",
    twoStageIntro:
      "De betaling verloopt in twee termijnen. Gelieve elk bedrag over te maken naar onderstaande rekening, met het vermelde betalingskenmerk:",
    collapsedIntro:
      "Gelieve het onderstaande bedrag over te maken naar onderstaande rekening, met het vermelde betalingskenmerk:",
    depositHeading: "1. Aanbetaling",
    balanceHeading: "2. Restbetaling (incl. borg)",
    singleHeading: "Volledige betaling (incl. borg)",
    depositRef: "aanbetaling",
    balanceRef: "restbetaling",
    borgNote: (borg) => `waarvan ${borg} borg (na het verblijf terugbetaald)`,
    releaseNote:
      "Als wij de aanbetaling niet vóór de vervaldatum ontvangen, vervalt de reservering automatisch.",
    balanceNote:
      "De restbetaling maakt uw reservering definitief; de borg ontvangt u na afloop van uw verblijf terug.",
    termsNote: (url) =>
      `Op uw reservering zijn onze <a href="${url}">algemene voorwaarden</a> van toepassing.`,
    signoff: "Met vriendelijke groeten,<br/>La Cour de Haut",
  },
  en: {
    intl: "en-GB",
    subject: "Your reservation at La Cour de Haut",
    greeting: (name) => `Dear ${name},`,
    intro:
      "Thank you for your booking at <strong>La Cour de Haut</strong>. We have reserved the following dates for you:",
    checkIn: "Check-in",
    checkOut: "Check-out",
    guests: "Guests",
    nights: "Total nights",
    discount: "10% long-stay discount (7+ nights)",
    totalPrice: "Total price",
    accountHolder: "Account holder",
    iban: "IBAN",
    bank: "Bank",
    reference: "Reference",
    amount: "Amount",
    dueBy: "Due by",
    twoStageIntro:
      "Payment is made in two instalments. Please transfer each amount to the account below, quoting the reference shown:",
    collapsedIntro:
      "Please transfer the amount below to the account below, quoting the reference shown:",
    depositHeading: "1. Deposit",
    balanceHeading: "2. Balance (incl. security deposit)",
    singleHeading: "Full payment (incl. security deposit)",
    depositRef: "deposit",
    balanceRef: "balance",
    borgNote: (borg) =>
      `of which ${borg} is a refundable security deposit (returned after your stay)`,
    releaseNote:
      "If we do not receive the deposit before the due date, your reservation will be released automatically.",
    balanceNote:
      "The balance confirms your reservation; the security deposit is returned to you after your stay.",
    termsNote: (url) =>
      `Your reservation is subject to our <a href="${url}">terms and conditions</a>.`,
    signoff: "Kind regards,<br/>La Cour de Haut",
  },
  fr: {
    intl: "fr-FR",
    subject: "Votre réservation à La Cour de Haut",
    greeting: (name) => `Cher(e) ${name},`,
    intro:
      "Merci pour votre réservation à <strong>La Cour de Haut</strong>. Nous avons réservé les dates suivantes pour vous :",
    checkIn: "Arrivée",
    checkOut: "Départ",
    guests: "Voyageurs",
    nights: "Nombre de nuits",
    discount: "Réduction long séjour 10% (7+ nuits)",
    totalPrice: "Prix total",
    accountHolder: "Titulaire du compte",
    iban: "IBAN",
    bank: "Banque",
    reference: "Référence",
    amount: "Montant",
    dueBy: "À régler avant le",
    twoStageIntro:
      "Le paiement s'effectue en deux versements. Veuillez virer chaque montant sur le compte ci-dessous, en indiquant la référence indiquée :",
    collapsedIntro:
      "Veuillez virer le montant ci-dessous sur le compte ci-dessous, en indiquant la référence indiquée :",
    depositHeading: "1. Acompte",
    balanceHeading: "2. Solde (caution incluse)",
    singleHeading: "Paiement intégral (caution incluse)",
    depositRef: "acompte",
    balanceRef: "solde",
    borgNote: (borg) =>
      `dont ${borg} de caution (restituée après votre séjour)`,
    releaseNote:
      "Si nous ne recevons pas l'acompte avant la date limite, la réservation sera automatiquement annulée.",
    balanceNote:
      "Le solde confirme votre réservation ; la caution vous est restituée après votre séjour.",
    termsNote: (url) =>
      `Votre réservation est soumise à nos <a href="${url}">conditions générales</a>.`,
    signoff: "Cordialement,<br/>La Cour de Haut",
  },
  de: {
    intl: "de-DE",
    subject: "Ihre Reservierung bei La Cour de Haut",
    greeting: (name) => `Liebe(r) ${name},`,
    intro:
      "Vielen Dank für Ihre Buchung bei <strong>La Cour de Haut</strong>. Wir haben die folgenden Daten für Sie reserviert:",
    checkIn: "Anreise",
    checkOut: "Abreise",
    guests: "Gäste",
    nights: "Gesamtnächte",
    discount: "10% Langzeitrabatt (7+ Nächte)",
    totalPrice: "Gesamtpreis",
    accountHolder: "Kontoinhaber",
    iban: "IBAN",
    bank: "Bank",
    reference: "Verwendungszweck",
    amount: "Betrag",
    dueBy: "Zu zahlen bis",
    twoStageIntro:
      "Die Zahlung erfolgt in zwei Raten. Bitte überweisen Sie jeden Betrag auf das untenstehende Konto unter Angabe des genannten Verwendungszwecks:",
    collapsedIntro:
      "Bitte überweisen Sie den untenstehenden Betrag auf das untenstehende Konto unter Angabe des genannten Verwendungszwecks:",
    depositHeading: "1. Anzahlung",
    balanceHeading: "2. Restzahlung (inkl. Kaution)",
    singleHeading: "Vollständige Zahlung (inkl. Kaution)",
    depositRef: "Anzahlung",
    balanceRef: "Restzahlung",
    borgNote: (borg) =>
      `davon ${borg} Kaution (nach Ihrem Aufenthalt zurückerstattet)`,
    releaseNote:
      "Wenn die Anzahlung nicht vor dem Fälligkeitsdatum eingeht, wird die Reservierung automatisch storniert.",
    balanceNote:
      "Die Restzahlung bestätigt Ihre Reservierung; die Kaution erhalten Sie nach Ihrem Aufenthalt zurück.",
    termsNote: (url) =>
      `Für Ihre Reservierung gelten unsere <a href="${url}">Allgemeinen Geschäftsbedingungen</a>.`,
    signoff: "Mit freundlichen Grüßen,<br/>La Cour de Haut",
  },
};

function row(label: string, value: string): string {
  return `<tr><th align="left">${label}</th><td>${value}</td></tr>`;
}

/** One payment instalment as its own bordered table. */
function paymentTable(
  heading: string,
  c: Copy,
  fmtCurrency: (n: number) => string,
  fmtDate: (iso: string) => string,
  amount: number,
  deadline: string,
  reference: string,
  bank: BankDetails,
  borgNote: string | null,
): string {
  return `
      <h3 style="margin-bottom:4px">${heading}</h3>
      <table cellpadding="6" style="border-collapse:collapse">
        ${row(c.amount, `<strong>${fmtCurrency(amount)}</strong>${borgNote ? ` <em>— ${esc(borgNote)}</em>` : ""}`)}
        ${row(c.dueBy, `<strong>${fmtDate(deadline)}</strong>`)}
        ${row(c.accountHolder, esc(bank.accountHolder))}
        ${row(c.iban, esc(bank.iban))}
        ${row(c.bank, esc(bank.bankName))}
        ${row(c.reference, esc(reference))}
      </table>`;
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

  const { nights, discount, totalPrice } = p.price;
  const termsUrl = `${getBaseUrl()}/${c.intl.slice(0, 2)}/terms`;
  const refBase = `${p.guest.name} - ${p.startDate}`;
  const borg = p.securityDeposit;
  const borgNote = borg > 0 ? c.borgNote(fmtCurrency(borg)) : null;

  const summary = `
      <table cellpadding="6" style="border-collapse:collapse">
        ${row(c.checkIn, fmtDate(p.startDate))}
        ${row(c.checkOut, fmtDate(p.endDate))}
        ${row(c.guests, String(p.guestCount))}
        ${row(c.nights, String(nights))}
        ${discount > 0 ? row(c.discount, `−${fmtCurrency(discount)}`) : ""}
        ${row(c.totalPrice, fmtCurrency(totalPrice))}
      </table>`;

  let paymentSection: string;
  if (p.schedule.collapsed) {
    paymentSection = `
      <p>${c.collapsedIntro}</p>
      ${paymentTable(
        c.singleHeading,
        c,
        fmtCurrency,
        fmtDate,
        p.schedule.totalAmount,
        p.schedule.deadline,
        refBase,
        p.bankDetails,
        borgNote,
      )}
      <p>${c.releaseNote}</p>`;
  } else {
    paymentSection = `
      <p>${c.twoStageIntro}</p>
      ${paymentTable(
        c.depositHeading,
        c,
        fmtCurrency,
        fmtDate,
        p.schedule.depositAmount,
        p.schedule.depositDeadline,
        `${refBase} - ${c.depositRef}`,
        p.bankDetails,
        null,
      )}
      ${paymentTable(
        c.balanceHeading,
        c,
        fmtCurrency,
        fmtDate,
        p.schedule.balanceAmount,
        p.schedule.balanceDeadline,
        `${refBase} - ${c.balanceRef}`,
        p.bankDetails,
        borgNote,
      )}
      <p>${c.releaseNote}</p>
      <p>${c.balanceNote}</p>`;
  }

  return {
    subject: c.subject,
    html: `
      <h2>${esc(c.greeting(p.guest.name))}</h2>
      <p>${c.intro}</p>
      ${summary}
      ${paymentSection}
      <p>${c.termsNote(termsUrl)}</p>
      <p>${c.signoff}</p>`,
  };
}

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
