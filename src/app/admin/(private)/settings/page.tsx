import { verifySession } from "@/lib/auth/session";
import { getSettings } from "@/lib/settings/settings";
import { SettingsForm } from "./settings-form";

export default async function SettingsPage() {
  await verifySession();
  const settings = await getSettings();

  return (
    <main className="min-h-screen p-8">
      <div className="max-w-2xl mx-auto space-y-10">
        <h1 className="text-2xl font-semibold">Instellingen</h1>
        <section className="space-y-4">
          <SettingsForm settings={settings} />
        </section>
      </div>
    </main>
  );
}
