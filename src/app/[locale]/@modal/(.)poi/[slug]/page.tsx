import { Suspense } from "react";
import { LoaderCircle } from "lucide-react";
import type { Locale } from "@/i18n/routing";
import { PoiDetailLoader } from "@/components/poi-detail-loader";
import { PoiModalClient } from "./poi-modal-client";

export default async function PoiModalPage({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>;
}) {
  const { locale, slug } = await params;

  return (
    <PoiModalClient>
      <Suspense
        fallback={
          <div className="grid h-96 place-content-center">
            <LoaderCircle className="size-30 animate-spin stroke-1 text-accent-foreground" />
          </div>
        }
      >
        <PoiDetailLoader slug={slug} locale={locale as Locale} />
      </Suspense>
    </PoiModalClient>
  );
}
