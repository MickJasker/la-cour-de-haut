import "server-only";
import { Resend } from "resend";

const esc = (s: string) =>
  s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

type EmailParams = {
  guest: { name: string; email: string };
  startDate: string;
  endDate: string;
  locale: string;
  /**
   * The full amount received (rental + borg), from `scheduleTotal` on the
   * frozen schedule — never re-derived here. Fires on both the two-stage
   * `mark_balance_paid` and the collapsed single `mark_paid`.
   */
  totalPaid: number;
  /** The borg (security deposit), included in `totalPaid`. */
  securityDeposit: number;
};

type Copy = {
  intl: string;
  subject: string;
  greeting: (name: string) => string;
  intro: string;
  checkIn: string;
  checkOut: string;
  totalPaid: string;
  borgNote: (borg: string) => string;
  seeYou: (date: string) => string;
  signoff: string;
};

const COPY: Record<string, Copy> = {
  nl: {
    intl: "nl-NL",
    subject: "Betaling ontvangen — uw boeking is compleet",
    greeting: (name) => `Beste ${name},`,
    intro:
      "Wij hebben uw volledige betaling ontvangen. Uw boeking bij <strong>La Cour de Haut</strong> is nu helemaal in orde.",
    checkIn: "Aankomst",
    checkOut: "Vertrek",
    totalPaid: "Totaal ontvangen",
    borgNote: (borg) => `waarvan ${borg} borg (na het verblijf terugbetaald)`,
    seeYou: (date) => `Tot ziens op ${date}!`,
    signoff: "Met vriendelijke groeten,<br/>La Cour de Haut",
  },
  en: {
    intl: "en-GB",
    subject: "Payment received — your booking is all set",
    greeting: (name) => `Dear ${name},`,
    intro:
      "We've received your full payment. Your booking at <strong>La Cour de Haut</strong> is now completely settled.",
    checkIn: "Check-in",
    checkOut: "Check-out",
    totalPaid: "Total received",
    borgNote: (borg) =>
      `of which ${borg} is a refundable security deposit (returned after your stay)`,
    seeYou: (date) => `See you on ${date}!`,
    signoff: "Kind regards,<br/>La Cour de Haut",
  },
  fr: {
    intl: "fr-FR",
    subject: "Paiement reçu — votre réservation est complète",
    greeting: (name) => `Cher(e) ${name},`,
    intro:
      "Nous avons bien reçu votre paiement intégral. Votre réservation à <strong>La Cour de Haut</strong> est désormais complète.",
    checkIn: "Arrivée",
    checkOut: "Départ",
    totalPaid: "Total reçu",
    borgNote: (borg) =>
      `dont ${borg} de caution (restituée après votre séjour)`,
    seeYou: (date) => `À bientôt, le ${date} !`,
    signoff: "Cordialement,<br/>La Cour de Haut",
  },
  de: {
    intl: "de-DE",
    subject: "Zahlung erhalten — Ihre Buchung ist vollständig",
    greeting: (name) => `Liebe(r) ${name},`,
    intro:
      "Wir haben Ihre vollständige Zahlung erhalten. Ihre Buchung bei <strong>La Cour de Haut</strong> ist nun vollständig abgeschlossen.",
    checkIn: "Anreise",
    checkOut: "Abreise",
    totalPaid: "Insgesamt erhalten",
    borgNote: (borg) =>
      `davon ${borg} Kaution (nach Ihrem Aufenthalt zurückerstattet)`,
    seeYou: (date) => `Wir freuen uns auf Sie am ${date}!`,
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

  const borg = p.securityDeposit;
  const borgNote = borg > 0 ? c.borgNote(fmtCurrency(borg)) : null;

  const summary = `
      <table cellpadding="6" style="border-collapse:collapse">
        ${row(c.checkIn, fmtDate(p.startDate))}
        ${row(c.checkOut, fmtDate(p.endDate))}
        ${row(c.totalPaid, `<strong>${fmtCurrency(p.totalPaid)}</strong>${borgNote ? ` <em>— ${esc(borgNote)}</em>` : ""}`)}
      </table>`;

  return {
    subject: c.subject,
    html: `
      <h2>${esc(c.greeting(p.guest.name))}</h2>
      <p>${c.intro}</p>
      ${summary}
      <p>${esc(c.seeYou(fmtDate(p.startDate)))}</p>
      <p>${c.signoff}</p>`,
  };
}

/**
 * Sends the balance-received receipt (payment complete). `applyTransition`
 * is the only caller and treats any rejection as a compensating-rollback
 * trigger (same policy as `sendBankTransferEmail` /
 * `sendDepositReceivedEmail`) — neither `mark_balance_paid` nor the
 * collapsed `mark_paid` may report success without the receipt actually
 * going out.
 */
export async function sendBalanceReceivedEmail(
  params: EmailParams,
): Promise<void> {
  if (process.env.E2E_TESTING) {
    return;
  }

  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    throw new Error(
      "RESEND_API_KEY is not configured; cannot send the balance-received email",
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
