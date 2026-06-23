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
        <h1 className="text-2xl font-semibold">Settings</h1>

        <section className="space-y-4">
          <div>
            <h2 className="text-lg font-medium">Bank transfer</h2>
            <p className="text-sm text-stone-500">
              These details are included in the bank-transfer email sent to
              guests when you confirm a booking.
            </p>
          </div>
          <form action={saveSettingsAction} className="space-y-4">
            <div className="space-y-1">
              <Label htmlFor="account_holder">Account holder</Label>
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
              <Label htmlFor="bank_name">Bank name</Label>
              <Input
                id="bank_name"
                name="bank_name"
                defaultValue={settings.bank_name ?? ""}
                placeholder="ABN AMRO"
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="payment_deadline_days">
                Payment deadline (days)
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
                Number of days from today that the guest has to pay when you
                confirm a booking.
              </p>
            </div>
            <Button type="submit">Save</Button>
          </form>
        </section>
      </div>
    </main>
  );
}
