import { verifySession } from "@/lib/dal";
import { getDb } from "@/db";
import { icalSource } from "@/db/schema";
import { SourceList } from "./source-list";
import { SourceForm } from "./source-form";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  await verifySession();

  const db = getDb();
  const sources = await db
    .select()
    .from(icalSource)
    .orderBy(icalSource.createdAt);

  return (
    <main className="min-h-screen p-8">
      <div className="max-w-2xl mx-auto space-y-8">
        <h1 className="text-2xl font-semibold">Settings</h1>

        <section className="space-y-4">
          <h2 className="text-lg font-medium">iCal sources</h2>
          <p className="text-sm text-gray-500">
            Feeds are refreshed lazily — a source older than 1 hour is
            re-fetched on the next booking form load. Editing a URL clears the
            cache immediately.
          </p>
          <SourceList sources={sources} />
        </section>

        <section className="space-y-4">
          <h2 className="text-lg font-medium">Add source</h2>
          <SourceForm mode="add" />
        </section>
      </div>
    </main>
  );
}
