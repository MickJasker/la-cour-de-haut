"use client";
import {
  initialFormState,
  mergeForm,
  revalidateLogic,
  useForm,
  useTransform,
} from "@tanstack/react-form-nextjs";
import { useActionState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Field, FieldError, FieldGroup, FieldSet } from "@/components/ui/field";
import {
  type SourceActionState,
  addSourceAction,
  updateSourceAction,
} from "./actions";
import { sourceFormOpts, sourceFormClientSchema } from "./shared";

type Props =
  | { mode: "add"; onSuccess?: () => void }
  | {
      mode: "edit";
      sourceId: string;
      defaultValues: { name: string; url: string; enabled: boolean };
      onSuccess?: () => void;
    };

export function SourceForm(props: Props) {
  const boundAction =
    props.mode === "edit"
      ? updateSourceAction.bind(null, props.sourceId)
      : addSourceAction;

  const [state, formAction, isPending] = useActionState<
    SourceActionState,
    FormData
  >(boundAction, { ...initialFormState, success: false });

  const defaults =
    props.mode === "edit"
      ? props.defaultValues
      : { name: "", url: "", enabled: true };

  const form = useForm({
    ...sourceFormOpts,
    defaultValues: defaults,
    validators: { onDynamic: sourceFormClientSchema },
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

  useEffect(() => {
    if (state.success) props.onSuccess?.();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.success]);

  return (
    <form
      action={formAction}
      noValidate
      className="space-y-4"
      onSubmit={() => {
        void form.handleSubmit();
      }}
    >
      <FieldGroup>
        <FieldSet>
          <form.Field name="name">
            {(field) => (
              <Field>
                <Label
                  htmlFor={
                    props.mode === "edit"
                      ? `source-name-${props.sourceId}`
                      : "source-name-add"
                  }
                >
                  Name
                </Label>
                <Input
                  id={
                    props.mode === "edit"
                      ? `source-name-${props.sourceId}`
                      : "source-name-add"
                  }
                  name={field.name}
                  value={field.state.value}
                  onChange={(e) => field.handleChange(e.target.value)}
                  onBlur={field.handleBlur}
                  placeholder="Airbnb"
                />
                <FieldError errors={field.state.meta.errors} />
              </Field>
            )}
          </form.Field>
        </FieldSet>

        <FieldSet>
          <form.Field name="url">
            {(field) => (
              <Field>
                <Label
                  htmlFor={
                    props.mode === "edit"
                      ? `source-url-${props.sourceId}`
                      : "source-url-add"
                  }
                >
                  iCal URL
                </Label>
                <Input
                  id={
                    props.mode === "edit"
                      ? `source-url-${props.sourceId}`
                      : "source-url-add"
                  }
                  name={field.name}
                  value={field.state.value}
                  onChange={(e) => field.handleChange(e.target.value)}
                  onBlur={field.handleBlur}
                  placeholder="https://www.airbnb.com/calendar/ical/..."
                  type="url"
                />
                <FieldError errors={field.state.meta.errors} />
              </Field>
            )}
          </form.Field>
        </FieldSet>

        <FieldSet>
          <form.Field name="enabled">
            {(field) => (
              <Field>
                {/* Hidden input carries the boolean string for FormData */}
                <input
                  type="hidden"
                  name={field.name}
                  value={String(field.state.value)}
                />
                <div className="flex items-center gap-2">
                  <Checkbox
                    id={
                      props.mode === "edit"
                        ? `source-enabled-${props.sourceId}`
                        : "source-enabled-add"
                    }
                    checked={field.state.value}
                    onCheckedChange={(checked) =>
                      field.handleChange(checked === true)
                    }
                  />
                  <Label
                    htmlFor={
                      props.mode === "edit"
                        ? `source-enabled-${props.sourceId}`
                        : "source-enabled-add"
                    }
                  >
                    Enabled
                  </Label>
                </div>
                <FieldError errors={field.state.meta.errors} />
              </Field>
            )}
          </form.Field>
        </FieldSet>

        <FieldSet>
          <Button type="submit" disabled={isPending}>
            {isPending
              ? "Saving…"
              : props.mode === "edit"
                ? "Save changes"
                : "Add source"}
          </Button>
        </FieldSet>
      </FieldGroup>
    </form>
  );
}
