import { useTranslations } from "next-intl";
import { Button } from "../ui/button";
import { Logo } from "../ui/logo";
import heroImage from "./hero.jpg";
import Image from "next/image";

export function Hero() {
  const t = useTranslations("sections.hero");

  return (
    <div className="grid grid-cols-[24px_1fr_24px] md:grid-cols-[24px_6fr_6fr_6fr_24px] lg:grid-cols-[2fr_3fr_4fr_4fr_2fr] xl:grid-cols-[2fr_3fr_1fr_8fr_2fr] h-svh max-h-225 gap-4 pb-30 md:pb-0 items-end md:items-center bg-brand-forest text-olive-50">
      <div className="col-span-full md:col-start-3 md:col-end-6 bg-cream-50 w-full h-full row-start-1 row-end-2 relative">
        <Image
          src={heroImage}
          alt=""
          className="w-full h-full object-cover bg-blend-multiply"
          fill
          loading="eager"
          aria-hidden="true"
          sizes="(max-width: 768px) 100vw, 66vw"
          placeholder="blur"
        />
        <div className="absolute h-150 md:h-full bottom-0 md:top-0 left-0 w-full md:w-125 bg-linear-to-t md:bg-linear-to-r from-brand-forest to-brand-forest/0"></div>
      </div>
      <div className="col-start-2 col-end-3 md:col-end-4 row-start-1 row-end-2 relative flex flex-col gap-6 text-sage">
        <h1 className="contents">
          <Logo className="w-full h-auto" />
        </h1>
        <p className="text-style-body-large">{t("description")}</p>
        <Button variant="secondary" size="lg" className="max-md:hidden">
          {t("callToAction")}
        </Button>
      </div>
    </div>
  );
}
