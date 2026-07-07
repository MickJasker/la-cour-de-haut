import { Logo } from "../ui/logo";
import { PROPERTY } from "@/lib/property";
import { Link } from "@/i18n/navigation";
import type { Locale } from "@/i18n/routing";
import { getPublishedPageBySlug } from "@/lib/pages/page-queries";
import { pickLocalized } from "@/lib/translation/localized-field";

export async function Footer({ locale }: { locale: string }) {
  const displayNames = new Intl.DisplayNames(locale, { type: "region" });
  const loc = locale as Locale;

  // System pages (ADR-0020) always exist, so a `null` result (lookup miss)
  // can't happen in practice. But a rejected query (DB hiccup) still can —
  // and `Promise.all` would propagate that rejection, taking the whole
  // `[locale]` layout down with it. `allSettled` degrades instead: a failed
  // lookup just omits that legal link rather than crashing the page.
  const [privacyResult, termsResult] = await Promise.allSettled([
    getPublishedPageBySlug("privacy"),
    getPublishedPageBySlug("terms"),
  ]);
  if (privacyResult.status === "rejected") {
    console.error("Failed to load the privacy page", privacyResult.reason);
  }
  if (termsResult.status === "rejected") {
    console.error("Failed to load the terms page", termsResult.reason);
  }
  const privacyPage =
    privacyResult.status === "fulfilled" ? privacyResult.value : null;
  const termsPage =
    termsResult.status === "fulfilled" ? termsResult.value : null;

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
