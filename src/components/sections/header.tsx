import { useTranslations } from "next-intl";
import { Button } from "../ui/button";

export function Header() {
  const t = useTranslations("sections.header");

  return (
    <header className="fixed bottom-0 left-0 w-full bg-olive-900 text-olive-50 z-10 p-6 md:grid md:grid-cols-[1fr_80px_80px_80px_80px_80px_80px_80px_80px_80px_80px_80px_80px_1fr] gap-4 md:items-center">
      <a
        href="tel:+33684337094"
        className="max-md:hidden md:col-start-2 col-span-3"
      >
        +33 6 84 33 70 94
      </a>
      <a
        href="mailto:info@lacourdehaut.fr"
        className="max-md:hidden md:col-start-5 col-span-3"
      >
        info@lacourdehaut.fr
      </a>
      <Button className="w-full md:col-start-11 md:col-end-14" size="lg">
        {t("bookNow")}
      </Button>
    </header>
  );
}
