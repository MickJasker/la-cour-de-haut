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
import {
  settingsRegistry,
  sectionMeta,
  type FieldMeta,
  type SettingKey,
} from "@/lib/settings/registry";
import type { Settings } from "@/lib/settings/settings";

/**
 * Group registry entries by section.
 * Render order follows `sectionMeta` key order, not registry insertion order,
 * so `sectionMeta` is the authoritative source for section sequencing.
 */
function groupBySection(): Array<[string, Array<[SettingKey, FieldMeta]>]> {
  const map = new Map<string, Array<[SettingKey, FieldMeta]>>();
  for (const [key, def] of Object.entries(settingsRegistry) as Array<
    [SettingKey, FieldMeta]
  >) {
    const group = map.get(def.section) ?? [];
    group.push([key, def]);
    map.set(def.section, group);
  }
  // Re-order by sectionMeta so its insertion order governs render sequence.
  return Object.keys(sectionMeta)
    .filter((s) => map.has(s))
    .map((s) => [s, map.get(s)!]);
}

const sections = groupBySection();

export function SettingsForm({ settings }: { settings: Settings }) {
  const [state, formAction, isPending] = useActionState<
    SettingsActionState,
    FormData
  >(saveSettingsAction, { ...initialFormState, success: false });

  const form = useForm({
    ...settingsFormOpts,
    defaultValues: Object.fromEntries(
      (Object.keys(settingsRegistry) as SettingKey[]).map((key) => {
        const raw = settings[key as keyof Settings];
        return [key, raw !== undefined && raw !== null ? String(raw) : ""];
      }),
    ) as SettingsFormValues,
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
        {sections.map(([sectionKey, fields], idx) => {
          const meta = sectionMeta[sectionKey];
          return (
            <div key={sectionKey}>
              {idx > 0 && <Separator />}
              <FieldSet>
                <h2 className="text-style-eyebrow-medium">{meta?.label}</h2>
                {meta?.description && (
                  <p className="text-sm text-stone-500">{meta.description}</p>
                )}

                {fields.map(([key, def]) => (
                  <form.Field name={key} key={key}>
                    {(field) => (
                      <Field data-field={key} className="space-y-1">
                        <FieldLabel htmlFor={key}>{def.label}</FieldLabel>
                        <Input
                          id={key}
                          name={field.name}
                          type={def.inputType}
                          value={field.state.value as string}
                          onChange={(e) => field.handleChange(e.target.value)}
                          onBlur={field.handleBlur}
                          placeholder={def.placeholder}
                          min={def.min}
                          max={def.max}
                          step={def.step}
                        />
                        {def.hint && (
                          <p className="text-xs text-stone-400">{def.hint}</p>
                        )}
                        <FieldError errors={field.state.meta.errors} />
                      </Field>
                    )}
                  </form.Field>
                ))}
              </FieldSet>
            </div>
          );
        })}

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
