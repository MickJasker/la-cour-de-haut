import { verifySession } from "@/lib/dal";
import { getDb } from "@/db";
import { galleryImage } from "@/db/schema";
import { asc } from "drizzle-orm";
import { GalleryList, UploadForm } from "./gallery-client";

export default async function GalleryAdminPage() {
  await verifySession();
  const db = getDb();
  const images = await db
    .select()
    .from(galleryImage)
    .orderBy(asc(galleryImage.sortOrder), asc(galleryImage.createdAt));

  return (
    <main className="min-h-screen p-8">
      <div className="max-w-3xl mx-auto space-y-8">
        <h1 className="text-2xl font-semibold">Galerij</h1>

        <section className="space-y-4">
          <h2 className="text-lg font-medium">Foto uploaden</h2>
          <UploadForm />
        </section>

        <section className="space-y-4">
          <h2 className="text-lg font-medium">Foto&apos;s</h2>
          <GalleryList images={images} />
        </section>
      </div>
    </main>
  );
}
