import { verifySession } from "@/lib/auth/session";
import { getDb } from "@/db";
import { page } from "@/db/schema";
import { asc, desc } from "drizzle-orm";
import { PagesClient } from "./pages-client";
import { getBaseUrl } from "@/lib/base-url";

export default async function PagesAdminPage() {
  await verifySession();
  const db = getDb();
  // System pages first (they're pinned, undeletable fixtures), then
  // owner-created pages oldest first.
  const pages = await db
    .select()
    .from(page)
    .orderBy(desc(page.system), asc(page.createdAt));

  const appUrl = getBaseUrl();

  return (
    <main className="min-h-screen p-8">
      <div className="max-w-3xl mx-auto space-y-8">
        <div>
          <h1 className="text-2xl font-semibold">Pagina&apos;s</h1>
          <p className="text-sm text-stone-500 mt-1">
            Beheer los toegankelijke pagina&apos;s zoals huisregels of lokale
            tips. Systeempagina&apos;s (privacybeleid, algemene voorwaarden)
            zijn altijd gepubliceerd en kunnen niet worden verwijderd.
          </p>
        </div>

        <PagesClient pages={pages} appUrl={appUrl} />
      </div>
    </main>
  );
}
