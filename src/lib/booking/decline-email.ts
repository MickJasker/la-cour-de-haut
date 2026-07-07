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
 * A short, polite "unfortunately not available for these dates" note (issue
 * #165). Today declined guests hear nothing at all. No amounts, no bank
 * details — this is a plain courtesy reply, not a payment-adjacent email.
 */
const COPY: Record<string, Copy> = {
  nl: {
    intl: "nl-NL",
    subject: "Uw aanvraag bij La Cour de Haut — datums niet beschikbaar",
    greeting: (name) => `Beste ${name},`,
    intro:
      "Bedankt voor uw aanvraag bij <strong>La Cour de Haut</strong>. Helaas zijn onderstaande datums niet beschikbaar:",
    checkIn: "Aankomst",
    checkOut: "Vertrek",
    signoff: "Met vriendelijke groeten,<br/>La Cour de Haut",
  },
  en: {
    intl: "en-GB",
    subject: "Your request at La Cour de Haut — dates not available",
    greeting: (name) => `Dear ${name},`,
    intro:
      "Thank you for your request at <strong>La Cour de Haut</strong>. Unfortunately, we are not available for the following dates:",
    checkIn: "Check-in",
    checkOut: "Check-out",
    signoff: "Kind regards,<br/>La Cour de Haut",
  },
  fr: {
    intl: "fr-FR",
    subject: "Votre demande à La Cour de Haut — dates non disponibles",
    greeting: (name) => `Cher(e) ${name},`,
    intro:
      "Merci pour votre demande à <strong>La Cour de Haut</strong>. Malheureusement, nous ne sommes pas disponibles aux dates suivantes :",
    checkIn: "Arrivée",
    checkOut: "Départ",
    signoff: "Cordialement,<br/>La Cour de Haut",
  },
  de: {
    intl: "de-DE",
    subject: "Ihre Anfrage bei La Cour de Haut — Termine nicht verfügbar",
    greeting: (name) => `Liebe(r) ${name},`,
    intro:
      "Vielen Dank für Ihre Anfrage bei <strong>La Cour de Haut</strong>. Leider sind wir für die folgenden Daten nicht verfügbar:",
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
 * Sends the decline notice. `applyTransition` is the only caller and treats
 * any rejection as a compensating-rollback trigger (same policy as the
 * cancellation and payment-schedule emails) — a `decline` must never report
 * success without the notice actually going out.
 */
export async function sendDeclineEmail(params: EmailParams): Promise<void> {
  if (process.env.E2E_TESTING) {
    return;
  }

  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    throw new Error(
      "RESEND_API_KEY is not configured; cannot send the decline email",
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
