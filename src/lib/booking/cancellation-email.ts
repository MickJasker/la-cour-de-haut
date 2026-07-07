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
};

type Copy = {
  intl: string;
  subject: string;
  greeting: (name: string) => string;
  intro: string;
  checkIn: string;
  checkOut: string;
  signoff: string;
};

/**
 * Confirms the cancellation and that the dates are released — nothing about
 * refunds, amounts, or bank details (issue #165). Money matters (refunding
 * the deposit/borg) stay off-platform; this email states the fact of the
 * cancellation only.
 */
const COPY: Record<string, Copy> = {
  nl: {
    intl: "nl-NL",
    subject: "Uw boeking bij La Cour de Haut is geannuleerd",
    greeting: (name) => `Beste ${name},`,
    intro:
      "Wij bevestigen dat uw boeking bij <strong>La Cour de Haut</strong> is geannuleerd. Onderstaande datums zijn weer vrijgegeven:",
    checkIn: "Aankomst",
    checkOut: "Vertrek",
    signoff: "Met vriendelijke groeten,<br/>La Cour de Haut",
  },
  en: {
    intl: "en-GB",
    subject: "Your booking at La Cour de Haut has been cancelled",
    greeting: (name) => `Dear ${name},`,
    intro:
      "This confirms that your booking at <strong>La Cour de Haut</strong> has been cancelled. The dates below have been released:",
    checkIn: "Check-in",
    checkOut: "Check-out",
    signoff: "Kind regards,<br/>La Cour de Haut",
  },
  fr: {
    intl: "fr-FR",
    subject: "Votre réservation à La Cour de Haut a été annulée",
    greeting: (name) => `Cher(e) ${name},`,
    intro:
      "Nous vous confirmons que votre réservation à <strong>La Cour de Haut</strong> a été annulée. Les dates suivantes ont été libérées :",
    checkIn: "Arrivée",
    checkOut: "Départ",
    signoff: "Cordialement,<br/>La Cour de Haut",
  },
  de: {
    intl: "de-DE",
    subject: "Ihre Buchung bei La Cour de Haut wurde storniert",
    greeting: (name) => `Liebe(r) ${name},`,
    intro:
      "Hiermit bestätigen wir, dass Ihre Buchung bei <strong>La Cour de Haut</strong> storniert wurde. Die folgenden Daten wurden wieder freigegeben:",
    checkIn: "Anreise",
    checkOut: "Abreise",
    signoff: "Mit freundlichen Grüßen,<br/>La Cour de Haut",
  },
};

function row(label: string, value: string): string {
  return `<tr><th align="left">${label}</th><td>${value}</td></tr>`;
}

function renderTemplate(p: EmailParams, c: Copy) {
  const dateFormatter = new Intl.DateTimeFormat(c.intl, {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
  const fmtDate = (iso: string) => dateFormatter.format(new Date(iso));

  const summary = `
      <table cellpadding="6" style="border-collapse:collapse">
        ${row(c.checkIn, fmtDate(p.startDate))}
        ${row(c.checkOut, fmtDate(p.endDate))}
      </table>`;

  return {
    subject: c.subject,
    html: `
      <h2>${esc(c.greeting(p.guest.name))}</h2>
      <p>${c.intro}</p>
      ${summary}
      <p>${c.signoff}</p>`,
  };
}

/**
 * Sends the cancellation notice. `applyTransition` is the only caller and
 * treats any rejection as a compensating-rollback trigger (same policy as
 * the payment-schedule emails) — a `cancel` must never report success
 * without the notice actually going out.
 */
export async function sendCancellationEmail(
  params: EmailParams,
): Promise<void> {
  if (process.env.E2E_TESTING) {
    return;
  }

  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    throw new Error(
      "RESEND_API_KEY is not configured; cannot send the cancellation email",
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
