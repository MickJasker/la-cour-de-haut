import { verifySession } from "@/lib/dal";
import { getDb } from "@/db";
import { icalSource } from "@/db/schema";
import { SourceList } from "./source-list";
import { SourceForm } from "./source-form";

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
        <h1 className="text-2xl font-semibold">iCal import</h1>

        <section className="space-y-4">
          <h2 className="text-lg font-medium">iCal-bronnen</h2>
          <p className="text-sm text-gray-500">
            Feeds worden lui vernieuwd — een bron ouder dan 5 minuten wordt
            opnieuw opgehaald bij het laden van het boekingsformulier. Gebruik
            &ldquo;Geforceerd synchroniseren&rdquo; om de cache onmiddellijk te
            wissen.
          </p>
          <SourceList sources={sources} />
        </section>

        <section className="space-y-4">
          <h2 className="text-lg font-medium">Bron toevoegen</h2>
          <SourceForm mode="add" />
        </section>
      </div>
    </main>
  );
}
