import { verifySession } from "@/lib/dal";
import { getSettings } from "@/lib/settings";
import { saveSettingsAction } from "./actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field, FieldLabel, FieldSet } from "@/components/ui/field";
import { Separator } from "@/components/ui/separator";

export default async function SettingsPage() {
  await verifySession();
  const settings = await getSettings();

  return (
    <main className="min-h-screen p-8">
      <div className="max-w-2xl mx-auto space-y-10">
        <h1 className="text-2xl font-semibold">Instellingen</h1>

        <section className="space-y-4">
          <form action={saveSettingsAction} className="space-y-10">
            <FieldSet>
              <h2 className="text-style-eyebrow-medium">Bankgegevens</h2>
              <p className="text-sm text-stone-500">
                Deze gegevens worden opgenomen in de overschrijvingse-mail die
                naar gasten wordt verstuurd wanneer u een boeking bevestigt.
              </p>
              <Field className="space-y-1">
                <FieldLabel htmlFor="account_holder">Rekeninghouder</FieldLabel>
                <Input
                  id="account_holder"
                  name="account_holder"
                  defaultValue={settings.account_holder ?? ""}
                  placeholder="La Cour de Haut"
                />
              </Field>
              <Field>
                <FieldLabel htmlFor="iban">IBAN</FieldLabel>
                <Input
                  id="iban"
                  name="iban"
                  defaultValue={settings.iban ?? ""}
                  placeholder="NL91 ABNA 0417 1643 00"
                />
              </Field>
              <Field>
                <FieldLabel htmlFor="bank_name">Banknaam</FieldLabel>
                <Input
                  id="bank_name"
                  name="bank_name"
                  defaultValue={settings.bank_name ?? ""}
                  placeholder="ABN AMRO"
                />
              </Field>
              <Field>
                <FieldLabel htmlFor="payment_deadline_days">
                  Betalingstermijn (dagen)
                </FieldLabel>
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
              </Field>
            </FieldSet>

            <Separator />

            <FieldSet>
              <h2 className="text-style-eyebrow-medium">Tarieven</h2>
              <Field>
                <FieldLabel htmlFor="price_per_night">
                  Prijs per nacht
                </FieldLabel>
                <Input
                  id="price_per_night"
                  name="price_per_night"
                  type="number"
                  min="1"
                  step="0.01"
                  defaultValue={settings.price_per_night ?? 0}
                />
              </Field>
            </FieldSet>
            <Button type="submit">Opslaan</Button>
          </form>
        </section>
      </div>
    </main>
  );
}
