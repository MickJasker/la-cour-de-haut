import { verifySession } from "@/lib/dal";
import { getDb } from "@/db";
import { poi } from "@/db/schema";
import { asc } from "drizzle-orm";
import { PoiClient } from "./poi-client";

export default async function PoisAdminPage() {
  await verifySession();
  const db = getDb();
  const pois = await db
    .select()
    .from(poi)
    .orderBy(asc(poi.sortOrder), asc(poi.createdAt));

  return (
    <main className="min-h-screen p-8">
      <div className="max-w-3xl mx-auto space-y-8">
        <h1 className="text-2xl font-semibold">POI&apos;s</h1>
        <PoiClient pois={pois} />
      </div>
    </main>
  );
}
