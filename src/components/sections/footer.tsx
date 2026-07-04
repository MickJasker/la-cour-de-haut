import { Logo } from "../ui/logo";
import { PROPERTY } from "@/lib/property";

export function Footer({ locale }: { locale: string }) {
  const displayNames = new Intl.DisplayNames(locale, { type: "region" });

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
    </footer>
  );
}
