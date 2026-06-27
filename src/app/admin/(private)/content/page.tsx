import { verifySession } from "@/lib/dal";
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
    .where(inArray(contentBlock.key, ["description", "hero_image_url"]));

  const descRow = rows.find((r) => r.key === "description") ?? null;
  const heroRow = rows.find((r) => r.key === "hero_image_url") ?? null;

  return (
    <main className="min-h-screen p-8">
      <div className="max-w-3xl mx-auto space-y-8">
        <h1 className="text-2xl font-semibold">Inhoud</h1>
        <ContentClient
          description={
            descRow?.value?.type === "localizedText" ? descRow.value : null
          }
          heroImageUrl={
            heroRow?.value?.type === "imageUrl" ? heroRow.value.url : null
          }
        />
      </div>
    </main>
  );
}
