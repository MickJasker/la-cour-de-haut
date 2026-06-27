"use client";

import {
  initialFormState,
  mergeForm,
  revalidateLogic,
  useForm,
  useTransform,
} from "@tanstack/react-form-nextjs";
import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Field,
  FieldError,
  FieldGroup,
  FieldLabel,
  FieldSet,
} from "@/components/ui/field";
import { Separator } from "@/components/ui/separator";
import { saveSettingsAction, type SettingsActionState } from "./actions";
import {
  settingsFormOpts,
  settingsFormClientSchema,
  type SettingsFormValues,
} from "./shared";
import type { Settings } from "@/lib/settings";

export function SettingsForm({ settings }: { settings: Settings }) {
  const [state, formAction, isPending] = useActionState<
    SettingsActionState,
    FormData
  >(saveSettingsAction, { ...initialFormState, success: false });

  const form = useForm({
    ...settingsFormOpts,
    defaultValues: {
      account_holder: settings.account_holder ?? "",
      iban: settings.iban ?? "",
      bank_name: settings.bank_name ?? "",
      payment_deadline_days: settings.payment_deadline_days
        ? String(settings.payment_deadline_days)
        : "",
      price_per_night: settings.price_per_night
        ? String(settings.price_per_night)
        : "",
    } satisfies SettingsFormValues,
    validators: { onDynamic: settingsFormClientSchema },
    validationLogic: revalidateLogic({
      mode: "submit",
      modeAfterSubmission: "change",
    }),
    transform: useTransform(
      (baseForm) =>
        state.values !== undefined ? mergeForm(baseForm, state) : baseForm,
      [state],
    ),
  });

  return (
    <form
      action={formAction}
      noValidate
      onSubmit={() => {
        void form.handleSubmit();
      }}
    >
      <FieldGroup>
        <FieldSet>
          <h2 className="text-style-eyebrow-medium">Bankgegevens</h2>
          <p className="text-sm text-stone-500">
            Deze gegevens worden opgenomen in de overschrijvingse-mail die naar
            gasten wordt verstuurd wanneer u een boeking bevestigt.
          </p>

          <form.Field name="account_holder">
            {(field) => (
              <Field data-field="account_holder" className="space-y-1">
                <FieldLabel htmlFor="account_holder">Rekeninghouder</FieldLabel>
                <Input
                  id="account_holder"
                  name={field.name}
                  value={field.state.value}
                  onChange={(e) => field.handleChange(e.target.value)}
                  onBlur={field.handleBlur}
                  placeholder="La Cour de Haut"
                />
                <FieldError errors={field.state.meta.errors} />
              </Field>
            )}
          </form.Field>

          <form.Field name="iban">
            {(field) => (
              <Field data-field="iban">
                <FieldLabel htmlFor="iban">IBAN</FieldLabel>
                <Input
                  id="iban"
                  name={field.name}
                  value={field.state.value}
                  onChange={(e) => field.handleChange(e.target.value)}
                  onBlur={field.handleBlur}
                  placeholder="NL91 ABNA 0417 1643 00"
                />
                <FieldError errors={field.state.meta.errors} />
              </Field>
            )}
          </form.Field>

          <form.Field name="bank_name">
            {(field) => (
              <Field data-field="bank_name">
                <FieldLabel htmlFor="bank_name">Banknaam</FieldLabel>
                <Input
                  id="bank_name"
                  name={field.name}
                  value={field.state.value}
                  onChange={(e) => field.handleChange(e.target.value)}
                  onBlur={field.handleBlur}
                  placeholder="ABN AMRO"
                />
                <FieldError errors={field.state.meta.errors} />
              </Field>
            )}
          </form.Field>

          <form.Field name="payment_deadline_days">
            {(field) => (
              <Field data-field="payment_deadline_days">
                <FieldLabel htmlFor="payment_deadline_days">
                  Betalingstermijn (dagen)
                </FieldLabel>
                <Input
                  id="payment_deadline_days"
                  name={field.name}
                  type="number"
                  min="1"
                  max="90"
                  value={field.state.value}
                  onChange={(e) => field.handleChange(e.target.value)}
                  onBlur={field.handleBlur}
                />
                <p className="text-xs text-stone-400">
                  Aantal dagen vanaf vandaag dat de gast heeft om te betalen
                  wanneer u een boeking bevestigt.
                </p>
                <FieldError errors={field.state.meta.errors} />
              </Field>
            )}
          </form.Field>
        </FieldSet>

        <Separator />

        <FieldSet>
          <h2 className="text-style-eyebrow-medium">Tarieven</h2>

          <form.Field name="price_per_night">
            {(field) => (
              <Field data-field="price_per_night">
                <FieldLabel htmlFor="price_per_night">
                  Prijs per nacht
                </FieldLabel>
                <Input
                  id="price_per_night"
                  name={field.name}
                  type="number"
                  min="1"
                  step="0.01"
                  value={field.state.value}
                  onChange={(e) => field.handleChange(e.target.value)}
                  onBlur={field.handleBlur}
                />
                <FieldError errors={field.state.meta.errors} />
              </Field>
            )}
          </form.Field>
        </FieldSet>

        <FieldSet>
          <div className="flex items-center gap-4">
            <Button type="submit" disabled={isPending}>
              {isPending ? "Opslaan…" : "Opslaan"}
            </Button>
            {state.success && !isPending && (
              <span className="text-sm text-green-600">Opgeslagen</span>
            )}
          </div>
        </FieldSet>
      </FieldGroup>
    </form>
  );
}
