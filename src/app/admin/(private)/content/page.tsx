import { verifySession } from "@/lib/auth/session";
import { getDb } from "@/db";
import { contentBlock } from "@/db/schema";
import { inArray } from "drizzle-orm";
import { ContentClient } from "./content-client";

export default async function ContentAdminPage() {
  await verifySession();

  const db = getDb();
  const rows = await db
    .select()
    .from(contentBlock)
    .where(
      inArray(contentBlock.key, [
        "description",
        "hero_image_url",
        "hero_description",
        "about_us_description",
        "general_info",
      ]),
    );

  const descRow = rows.find((r) => r.key === "description") ?? null;
  const heroImageRow = rows.find((r) => r.key === "hero_image_url") ?? null;
  const heroDescRow = rows.find((r) => r.key === "hero_description") ?? null;
  const aboutUsDescRow =
    rows.find((r) => r.key === "about_us_description") ?? null;
  const aboutUsDescValueSource = aboutUsDescRow?.valueSource ?? null;
  const generalInfoRow = rows.find((r) => r.key === "general_info") ?? null;
  const generalInfoValueSource = generalInfoRow?.valueSource ?? null;

  return (
    <main className="min-h-screen p-8">
      <div className="max-w-3xl mx-auto space-y-8">
        <h1 className="text-2xl font-semibold">Inhoud</h1>
        <ContentClient
          description={
            descRow?.value?.type === "localizedEditorState"
              ? descRow.value
              : null
          }
          descriptionValueSource={descRow?.valueSource ?? null}
          heroDescription={
            heroDescRow?.value?.type === "localizedEditorState"
              ? heroDescRow.value
              : null
          }
          heroDescriptionValueSource={heroDescRow?.valueSource ?? null}
          heroImageUrl={
            heroImageRow?.value?.type === "imageUrl"
              ? heroImageRow.value.url
              : null
          }
          aboutUsDescription={
            aboutUsDescRow?.value?.type === "localizedEditorState"
              ? aboutUsDescRow.value
              : null
          }
          aboutUsDescriptionValueSource={aboutUsDescValueSource}
          generalInfo={
            generalInfoRow?.value?.type === "localizedEditorState"
              ? generalInfoRow.value
              : null
          }
          generalInfoValueSource={generalInfoValueSource}
        />
      </div>
    </main>
  );
}
