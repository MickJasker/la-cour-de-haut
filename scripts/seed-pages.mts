/**
 * Seeds the two system pages (`privacy`, `terms`) required by ADR-0020.
 *
 * System pages are editable in /admin/pages but undeletable and always
 * published; the booking form's privacy notice and the footer's legal links
 * hardcode their slugs, so a fresh deploy must have both rows present before
 * the app serves a page. That's why this is chained into `db:migrate` (which
 * runs inside `pnpm build`) rather than being a manual one-off.
 *
 * Idempotent: `onConflictDoNothing` on the unique slug only ever fills a
 * MISSING page, so re-running on every deploy never clobbers content the
 * owner later edited in /admin/pages.
 *
 * The privacy copy is the (formerly hardcoded) message-file copy in all four
 * locales; per ADR-0016 the en/fr/de slots are marked `machine` even though
 * hand-written, so the first Dutch edit hands them to auto-translate. The
 * terms copy is a four-locale placeholder the owner replaces in admin.
 *
 * Only issues INSERT (no DDL), so the pooled `DATABASE_URL` is fine.
 *
 * Run with: pnpm seed-pages
 */
try {
  process.loadEnvFile(".env.local");
} catch {}

const { getDb } = await import("../src/db/index.js");
const { page } = await import("../src/db/schema.js");
const { editorStateFromBlocks } =
  await import("../src/lib/content/lexical/build-state.js");

const db = getDb();

const TURNSTILE_ADDENDUM_URL =
  "https://www.cloudflare.com/cloudflare-turnstile-privacy-addendum/";

type PrivacyCopy = {
  intro: string;
  sections: [heading: string, body: string][];
  turnstileTitle: string;
  turnstileBefore: string;
  turnstileLink: string;
  turnstileAfter: string;
};

function privacyBody(copy: PrivacyCopy) {
  return editorStateFromBlocks([
    { type: "paragraph", children: [copy.intro] },
    ...copy.sections.flatMap(
      ([heading, body]): Parameters<typeof editorStateFromBlocks>[0] => [
        { type: "heading", text: heading },
        { type: "paragraph", children: [body] },
      ],
    ),
    { type: "heading", text: copy.turnstileTitle },
    {
      type: "paragraph",
      children: [
        copy.turnstileBefore,
        { text: copy.turnstileLink, href: TURNSTILE_ADDENDUM_URL },
        copy.turnstileAfter,
      ],
    },
  ]);
}

const privacy = {
  nl: privacyBody({
    intro:
      "La Cour de Haut verwerkt persoonsgegevens in verband met boekingsverzoeken. Deze kennisgeving legt uit welke gegevens wij verzamelen, waarom, en hoe lang wij deze bewaren.",
    sections: [
      [
        "Welke gegevens verzamelen wij?",
        "Via het boekingsformulier verzamelen wij: uw voor- en achternaam, e-mailadres, telefoonnummer, postadres (straat, postcode, woonplaats en land) en de gewenste verblijfsdata.",
      ],
      [
        "Waarvoor worden uw gegevens gebruikt?",
        "Wij gebruiken uw gegevens om te reageren op uw boekingsverzoek, de beschikbaarheid te bevestigen, verdere betalings- en verblijfsinformatie te verstrekken en voor onze administratie en de huurovereenkomst.",
      ],
      [
        "Hoe lang bewaren wij uw gegevens?",
        "Wij bewaren uw gegevens zo lang als nodig is voor de afhandeling van uw boekingsverzoek en de bijbehorende correspondentie. U kunt op elk moment om verwijdering verzoeken door contact met ons op te nemen.",
      ],
      [
        "Uw rechten",
        "U heeft het recht op inzage, rectificatie en verwijdering van uw persoonsgegevens. Voor vragen of verzoeken kunt u contact opnemen via: info@lacourdehaut.fr.",
      ],
      ["Contact", "La Cour de Haut — info@lacourdehaut.fr"],
    ],
    turnstileTitle: "Spambeveiliging (Cloudflare Turnstile)",
    turnstileBefore:
      "Om ons boekingsformulier te beschermen tegen spam en misbruik, gebruiken wij Cloudflare Turnstile in onzichtbare modus. Turnstile kan technische informatie verzamelen (zoals IP-adres en browsergegevens) om te beoordelen of een verzoek van een mens afkomstig is. Zie voor meer informatie het ",
    turnstileLink: "Cloudflare Turnstile Privacy Addendum",
    turnstileAfter: ".",
  }),
  en: privacyBody({
    intro:
      "La Cour de Haut processes personal data in connection with booking requests. This notice explains what data we collect, why, and how long we retain it.",
    sections: [
      [
        "What data do we collect?",
        "Through the booking form we collect: your first and last name, email address, phone number, postal address (street, postal code, city, and country), and your requested stay dates.",
      ],
      [
        "Why do we use your data?",
        "We use your data to respond to your booking request, confirm availability, provide further payment and stay information, and for our records and the rental agreement.",
      ],
      [
        "How long do we retain your data?",
        "We retain your data for as long as necessary to handle your booking request and any related correspondence. You can request deletion at any time by contacting us.",
      ],
      [
        "Your rights",
        "You have the right to access, rectify, and delete your personal data. For questions or requests, please contact us at: info@lacourdehaut.fr.",
      ],
      ["Contact", "La Cour de Haut — info@lacourdehaut.fr"],
    ],
    turnstileTitle: "Spam protection (Cloudflare Turnstile)",
    turnstileBefore:
      "To protect our booking form against spam and abuse, we use Cloudflare Turnstile in invisible mode. Turnstile may collect technical information (such as IP address and browser data) to assess whether a request is human. For more information, see the ",
    turnstileLink: "Cloudflare Turnstile Privacy Addendum",
    turnstileAfter: ".",
  }),
  fr: privacyBody({
    intro:
      "La Cour de Haut traite des données personnelles dans le cadre des demandes de réservation. Cette notice explique quelles données nous collectons, pourquoi, et combien de temps nous les conservons.",
    sections: [
      [
        "Quelles données collectons-nous ?",
        "Via le formulaire de réservation, nous collectons : votre prénom et nom de famille, adresse e-mail, numéro de téléphone, adresse postale (rue, code postal, ville et pays) et les dates de séjour souhaitées.",
      ],
      [
        "Pourquoi utilisons-nous vos données ?",
        "Nous utilisons vos données pour répondre à votre demande de réservation, confirmer la disponibilité, fournir des informations de paiement et de séjour, ainsi que pour notre gestion administrative et le contrat de location.",
      ],
      [
        "Combien de temps conservons-nous vos données ?",
        "Nous conservons vos données aussi longtemps que nécessaire pour traiter votre demande de réservation et la correspondance associée. Vous pouvez demander la suppression à tout moment en nous contactant.",
      ],
      [
        "Vos droits",
        "Vous avez le droit d'accéder, de rectifier et de supprimer vos données personnelles. Pour toute question ou demande, contactez-nous à : info@lacourdehaut.fr.",
      ],
      ["Contact", "La Cour de Haut — info@lacourdehaut.fr"],
    ],
    turnstileTitle: "Protection anti-spam (Cloudflare Turnstile)",
    turnstileBefore:
      "Pour protéger notre formulaire de réservation contre le spam et les abus, nous utilisons Cloudflare Turnstile en mode invisible. Turnstile peut collecter des informations techniques (telles que l'adresse IP et les données du navigateur) pour évaluer si une demande provient d'un être humain. Pour plus d'informations, consultez l'",
    turnstileLink: "Avenant de confidentialité Cloudflare Turnstile",
    turnstileAfter: ".",
  }),
  de: privacyBody({
    intro:
      "La Cour de Haut verarbeitet personenbezogene Daten im Zusammenhang mit Buchungsanfragen. Diese Erklärung erläutert, welche Daten wir erheben, warum und wie lange wir sie aufbewahren.",
    sections: [
      [
        "Welche Daten erheben wir?",
        "Über das Buchungsformular erheben wir: Ihren Vor- und Nachnamen, Ihre E-Mail-Adresse, Telefonnummer, Postanschrift (Straße, Postleitzahl, Stadt und Land) und die gewünschten Aufenthaltsdaten.",
      ],
      [
        "Wofür verwenden wir Ihre Daten?",
        "Wir verwenden Ihre Daten zur Beantwortung Ihrer Buchungsanfrage, zur Bestätigung der Verfügbarkeit, zur Bereitstellung weiterer Zahlungs- und Aufenthaltsinformationen sowie für unsere Buchführung und den Mietvertrag.",
      ],
      [
        "Wie lange bewahren wir Ihre Daten auf?",
        "Wir bewahren Ihre Daten so lange auf, wie es für die Bearbeitung Ihrer Buchungsanfrage und die damit verbundene Korrespondenz erforderlich ist. Sie können jederzeit die Löschung beantragen, indem Sie uns kontaktieren.",
      ],
      [
        "Ihre Rechte",
        "Sie haben das Recht auf Auskunft, Berichtigung und Löschung Ihrer personenbezogenen Daten. Bei Fragen oder Anträgen kontaktieren Sie uns unter: info@lacourdehaut.fr.",
      ],
      ["Kontakt", "La Cour de Haut — info@lacourdehaut.fr"],
    ],
    turnstileTitle: "Spam-Schutz (Cloudflare Turnstile)",
    turnstileBefore:
      "Zum Schutz unseres Buchungsformulars vor Spam und Missbrauch verwenden wir Cloudflare Turnstile im unsichtbaren Modus. Turnstile kann technische Informationen (wie IP-Adresse und Browserdaten) erfassen, um zu beurteilen, ob eine Anfrage von einem Menschen stammt. Weitere Informationen finden Sie im ",
    turnstileLink: "Cloudflare Turnstile Datenschutz-Addendum",
    turnstileAfter: ".",
  }),
};

function termsBody(text: string) {
  return editorStateFromBlocks([{ type: "paragraph", children: [text] }]);
}

const SEEDED_SOURCE = {
  nl: "human",
  en: "machine",
  fr: "machine",
  de: "machine",
} as const;

const SEED = [
  {
    id: "page_privacy",
    slug: "privacy",
    title: {
      nl: "Privacybeleid",
      en: "Privacy Policy",
      fr: "Politique de confidentialité",
      de: "Datenschutzerklärung",
    },
    titleSource: SEEDED_SOURCE,
    body: privacy,
    bodySource: SEEDED_SOURCE,
    published: true,
    system: true,
  },
  {
    id: "page_terms",
    slug: "terms",
    title: {
      nl: "Algemene voorwaarden",
      en: "Terms and Conditions",
      fr: "Conditions générales",
      de: "Allgemeine Geschäftsbedingungen",
    },
    titleSource: SEEDED_SOURCE,
    body: {
      nl: termsBody(
        "De algemene voorwaarden worden binnenkort gepubliceerd. Neem bij vragen contact op via info@lacourdehaut.fr.",
      ),
      en: termsBody(
        "The terms and conditions will be published shortly. If you have any questions, please contact info@lacourdehaut.fr.",
      ),
      fr: termsBody(
        "Les conditions générales seront publiées prochainement. Pour toute question, contactez info@lacourdehaut.fr.",
      ),
      de: termsBody(
        "Die Allgemeinen Geschäftsbedingungen werden in Kürze veröffentlicht. Bei Fragen wenden Sie sich bitte an info@lacourdehaut.fr.",
      ),
    },
    bodySource: SEEDED_SOURCE,
    published: true,
    system: true,
  },
];

const result = await db
  .insert(page)
  .values(SEED)
  .onConflictDoNothing({ target: page.slug })
  .returning({ slug: page.slug });

console.log(
  `Pages seed: ${result.length} of ${SEED.length} inserted ` +
    `(${SEED.length - result.length} already present, left untouched).`,
);
