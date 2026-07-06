import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { locales, type Locale } from "@/i18n/routing";
import { RichTextRenderer } from "@/components/rich-text-renderer";
import { pickLocalized } from "@/lib/translation/localized-field";
import { editorStateToPlainText } from "@/lib/content/lexical/plain-text";
import { truncateForMeta } from "@/lib/seo/meta-text";
import {
  getPublishedPageBySlug,
  pageStaticParams,
} from "@/lib/pages/page-queries";
import { SiteHeader } from "@/components/sections/site-header";
import { Button } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";
import { getTranslations } from "@/i18n/server";
import { cacheLife, cacheTag } from "next/cache";
import { CACHE_TAGS } from "@/lib/cache-tags";

const BASE_URL = process.env.NEXT_PUBLIC_APP_URL ?? "https://lacourdehaut.fr";

// Owner-managed pages (ADR-0020) live at top-level /{locale}/{slug}. Static
// segments (book, poi, …) take precedence over this dynamic one; the admin
// create action refuses reserved slugs so a page can never be shadowed.
export const generateStaticParams = pageStaticParams;

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>;
}): Promise<Metadata> {
  const { locale, slug } = await params;
  const item = await getPublishedPageBySlug(slug);
  if (!item) return {};

  const loc = locale as Locale;
  const title = pickLocalized(item.title, loc);
  // No separate description field (ADR-0020): excerpt the body text.
  const description = truncateForMeta(
    editorStateToPlainText(pickLocalized(item.body, loc)),
  );

  return {
    title,
    description,
    alternates: {
      canonical: `${BASE_URL}/${locale}/${slug}`,
      languages: Object.fromEntries([
        ...locales.map((l) => [l, `${BASE_URL}/${l}/${slug}`]),
        ["x-default", `${BASE_URL}/nl/${slug}`],
      ]),
    },
    openGraph: {
      url: `${BASE_URL}/${locale}/${slug}`,
      title,
      description,
    },
  };
}

export default async function OwnerManagedPage({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>;
}) {
  "use cache";
  cacheLife("max");
  cacheTag(CACHE_TAGS.pages);

  const { locale, slug } = await params;

  const [t, item] = await Promise.all([
    getTranslations({ locale: locale as Locale, namespace: "booking" }),
    getPublishedPageBySlug(slug),
  ]);
  if (!item) notFound();

  return (
    <>
      <SiteHeader
        action={
          <Button
            asChild
            className="w-full md:col-start-10 lg:col-start-11 md:col-end-14"
            size="lg"
          >
            <Link href={`/`}>{t("aboutAction")}</Link>
          </Button>
        }
      />
      <main className="flex flex-col flex-1 items-center p-6 py-12">
        <article className="w-full max-w-2xl space-y-8">
          <h1 className="text-style-display-medium">
            {pickLocalized(item.title, locale as Locale)}
          </h1>
          <RichTextRenderer
            state={pickLocalized(item.body, locale as Locale)}
          />
        </article>
      </main>
    </>
  );
}
