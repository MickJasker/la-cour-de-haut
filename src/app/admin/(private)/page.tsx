import { verifySession } from "@/lib/dal";

export default async function AdminPage() {
  const session = await verifySession();

  return (
    <main className="min-h-screen p-8">
      <div className="">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-semibold">Beheer</h1>
        </div>

        <div className="rounded-md border border-stone-200 bg-stone-50 p-4 text-sm text-stone-700">
          <p>
            Aangemeld als <strong>{session.user.email}</strong>
          </p>
        </div>

        <p className="text-stone-500 text-sm">Dashboard komt binnenkort.</p>
      </div>
    </main>
  );
}
