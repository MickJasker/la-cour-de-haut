import { verifySession } from "@/lib/dal";
import { getSettings } from "@/lib/settings";
import { saveSettingsAction } from "./actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default async function SettingsPage() {
  await verifySession();
  const settings = await getSettings();

  return (
    <main className="min-h-screen p-8">
      <div className="max-w-2xl mx-auto space-y-10">
        <h1 className="text-2xl font-semibold">Instellingen</h1>

        <section className="space-y-4">
          <div>
            <h2 className="text-lg font-medium">Bankoverschrijving</h2>
            <p className="text-sm text-stone-500">
              Deze gegevens worden opgenomen in de overschrijvingse-mail die
              naar gasten wordt verstuurd wanneer u een boeking bevestigt.
            </p>
          </div>
          <form action={saveSettingsAction} className="space-y-4">
            <div className="space-y-1">
              <Label htmlFor="account_holder">Rekeninghouder</Label>
              <Input
                id="account_holder"
                name="account_holder"
                defaultValue={settings.account_holder ?? ""}
                placeholder="La Cour de Haut"
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="iban">IBAN</Label>
              <Input
                id="iban"
                name="iban"
                defaultValue={settings.iban ?? ""}
                placeholder="NL91 ABNA 0417 1643 00"
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="bank_name">Banknaam</Label>
              <Input
                id="bank_name"
                name="bank_name"
                defaultValue={settings.bank_name ?? ""}
                placeholder="ABN AMRO"
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="payment_deadline_days">
                Betalingstermijn (dagen)
              </Label>
              <Input
                id="payment_deadline_days"
                name="payment_deadline_days"
                type="number"
                min="1"
                max="90"
                defaultValue={settings.payment_deadline_days ?? 7}
              />
              <p className="text-xs text-stone-400">
                Aantal dagen vanaf vandaag dat de gast heeft om te betalen
                wanneer u een boeking bevestigt.
              </p>
            </div>
            <Button type="submit">Opslaan</Button>
          </form>
        </section>
      </div>
    </main>
  );
}
