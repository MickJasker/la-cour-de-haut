import { verifySession } from "@/lib/dal";
import { LogoutButton } from "./logout-button";

export default async function AdminPage() {
  const session = await verifySession();

  return (
    <main className="min-h-screen p-8">
      <div className="max-w-2xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-semibold">Admin</h1>
          <LogoutButton />
        </div>

        <div className="rounded-md border border-gray-200 bg-gray-50 p-4 text-sm text-gray-700">
          <p>
            Signed in as <strong>{session.user.email}</strong>
          </p>
        </div>

        <p className="text-gray-500 text-sm">Dashboard coming soon.</p>
      </div>
    </main>
  );
}
