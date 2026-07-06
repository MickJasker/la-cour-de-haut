import { Logo } from "../ui/logo";
import { PROPERTY } from "@/lib/property";
import { Link } from "@/i18n/navigation";
import type { Locale } from "@/i18n/routing";
import { getPublishedPageBySlug } from "@/lib/pages/page-queries";
import { pickLocalized } from "@/lib/translation/localized-field";

export async function Footer({ locale }: { locale: string }) {
  const displayNames = new Intl.DisplayNames(locale, { type: "region" });
  const loc = locale as Locale;

  // System pages (ADR-0020) always exist, but stay defensive: never let a
  // lookup miss crash the footer, just omit that link.
  const [privacyPage, termsPage] = await Promise.all([
    getPublishedPageBySlug("privacy"),
    getPublishedPageBySlug("terms"),
  ]);

  return (
    <footer className="bg-brand-forest text-olive-50 flex flex-col items-center justify-center p-10 gap-10">
      <Logo className="w-100 max-w-full h-auto" />
      <address className="text-style-body-large text-center not-italic">
        {PROPERTY.address.streetAddress}
        <br />
        {PROPERTY.address.postalCode} {PROPERTY.address.addressLocality}
        <br />
        {displayNames.of(PROPERTY.address.addressCountry)}
      </address>
      {(privacyPage ?? termsPage) && (
        <nav
          aria-label="Legal"
          className="text-style-body-small flex gap-6 opacity-70"
        >
          {privacyPage && (
            <Link href="/privacy" className="hover:underline">
              {pickLocalized(privacyPage.title, loc)}
            </Link>
          )}
          {termsPage && (
            <Link href="/terms" className="hover:underline">
              {pickLocalized(termsPage.title, loc)}
            </Link>
          )}
        </nav>
      )}
    </footer>
  );
}
