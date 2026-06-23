import { verifySession } from "@/lib/dal";
import { getDb } from "@/db";
import { icalExportToken } from "@/db/schema";
import { TokenList } from "./token-list";
import { createExportTokenAction } from "./actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default async function ExportPage() {
  await verifySession();

  const db = getDb();
  const tokens = await db
    .select()
    .from(icalExportToken)
    .orderBy(icalExportToken.createdAt);

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://lacourdehaut.fr";

  return (
    <main className="min-h-screen p-8">
      <div className="max-w-2xl mx-auto space-y-8">
        <div>
          <h1 className="text-2xl font-semibold">iCal export</h1>
          <p className="text-sm text-stone-500 mt-1">
            Each platform gets its own feed URL. Revoking a token immediately
            stops that platform from syncing — without affecting others.
          </p>
        </div>

        <section className="space-y-4">
          <h2 className="text-lg font-medium">Active tokens</h2>
          <TokenList tokens={tokens} appUrl={appUrl} />
        </section>

        <section className="space-y-4">
          <h2 className="text-lg font-medium">Add token</h2>
          <form
            action={createExportTokenAction}
            className="flex items-end gap-3"
          >
            <div className="flex-1 space-y-1">
              <Label htmlFor="token-name">Platform name</Label>
              <Input
                id="token-name"
                name="name"
                placeholder="Airbnb"
                required
              />
            </div>
            <Button type="submit">Generate</Button>
          </form>
        </section>
      </div>
    </main>
  );
}
