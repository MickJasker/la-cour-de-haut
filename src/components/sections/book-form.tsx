"use client";
import {
  initialFormState,
  mergeForm,
  revalidateLogic,
  useForm,
  useTransform,
} from "@tanstack/react-form-nextjs";
import { use, useActionState } from "react";
import { Button } from "../ui/button";
import { Label } from "../ui/label";
import { Input } from "../ui/input";
import {
  Field,
  FieldError,
  FieldGroup,
  FieldLabel,
  FieldSet,
} from "../ui/field";
import { RadioGroup, RadioGroupItem } from "../ui/radio-group";
import { useId } from "react";
import { addDays, addMonths } from "date-fns";
import { Calendar } from "../ui/calendar";
import { useFormatter, useTranslations } from "next-intl";
import { cn } from "@/lib/utils";
import { Separator } from "../ui/separator";
import { CircleCheckBig } from "lucide-react";
import {
  submitBookingAction,
  type BookingActionState,
} from "@/app/[locale]/book/action";
import { formOpts } from "@/app/[locale]/book/shared";
import { createBookingFormSchema } from "@/app/[locale]/book/shared";

const pricePerNight = 85; // This is a placeholder value. For a real application, you might want to fetch this from a config or database.

export function BookForm({ bookedDates }: { bookedDates: Promise<string[]> }) {
  const t = useTranslations("booking");

  const booked = use(bookedDates);

  const [state, formAction, isPending] = useActionState<
    BookingActionState,
    FormData
  >(submitBookingAction, { ...initialFormState, success: false });

  const form = useForm({
    ...formOpts,
    validators: {
      onDynamic: createBookingFormSchema(t),
    },
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

  const id = useId();

  const formatter = useFormatter();

  const isSuccessful = state.success;

  return (
    <div className="relative">
      <div
        className={cn(
          "flex flex-col gap-4 items-center justify-center w-full h-full absolute inset-0",
          { hidden: !isSuccessful },
        )}
      >
        <CircleCheckBig className="text-positive size-30 stroke-1" />
        <p className="text-style-body-large text-positive text-center">
          {t("form.successMessage")}
        </p>
        <p className="text-sm text-pretty text-center">
          {t("form.disclaimer")}
        </p>
      </div>
      <form
        action={formAction}
        noValidate
        className={cn("w-full max-w-2xl space-y-6", {
          invisible: isSuccessful,
        })}
        onSubmit={() => {
          void form.handleSubmit();
        }}
      >
        <FieldGroup>
          <FieldSet>
            <form.Field name="name">
              {(field) => (
                <Field>
                  <Label htmlFor="name">{t("form.name")}</Label>
                  <Input
                    id="name"
                    type="text"
                    name={field.name}
                    value={field.state.value}
                    onChange={(e) => field.handleChange(e.target.value)}
                    onBlur={field.handleBlur}
                  />
                  <FieldError errors={field.state.meta.errors} />
                </Field>
              )}
            </form.Field>
          </FieldSet>

          <FieldSet className="md:grid md:grid-cols-2">
            <form.Field name="email">
              {(field) => (
                <Field>
                  <FieldLabel htmlFor="email">{t("form.email")}</FieldLabel>
                  <Input
                    id="email"
                    type="email"
                    name={field.name}
                    value={field.state.value}
                    onChange={(e) => field.handleChange(e.target.value)}
                    onBlur={field.handleBlur}
                  />
                  <FieldError errors={field.state.meta.errors} />
                </Field>
              )}
            </form.Field>

            <form.Field name="phone">
              {(field) => (
                <Field>
                  <FieldLabel htmlFor="phone">{t("form.phone")}</FieldLabel>
                  <Input
                    id="phone"
                    type="tel"
                    name={field.name}
                    value={field.state.value}
                    onChange={(e) => field.handleChange(e.target.value)}
                    onBlur={field.handleBlur}
                  />
                  <FieldError errors={field.state.meta.errors} />
                </Field>
              )}
            </form.Field>
          </FieldSet>

          <FieldSet className="md:grid md:grid-cols-2">
            <form.Field name="guestCount">
              {(field) => (
                <Field>
                  <FieldLabel htmlFor="guestCount">
                    {t("form.guestCount")}
                  </FieldLabel>
                  <RadioGroup
                    name={field.name}
                    value={field.state.value}
                    onValueChange={(value) =>
                      field.handleChange(value as "1" | "2")
                    }
                    onBlur={field.handleBlur}
                    className="mt-2"
                  >
                    <div className="flex items-center gap-2">
                      <RadioGroupItem value="1" id={`${id}-1`} />
                      <Label htmlFor={`${id}-1`}>
                        {t("form.guestCountOption", { count: 1 })}
                      </Label>
                    </div>
                    <div className="flex items-center gap-2">
                      <RadioGroupItem value="2" id={`${id}-2`} />
                      <Label htmlFor={`${id}-2`}>
                        {t("form.guestCountOption", { count: 2 })}
                      </Label>
                    </div>
                  </RadioGroup>
                  <FieldError errors={field.state.meta.errors} />
                </Field>
              )}
            </form.Field>
            <form.Field name="stayDates">
              {(field) => (
                <Field>
                  <input
                    type="hidden"
                    name="stayDates.from"
                    value={field.state.value?.from}
                  />
                  <input
                    type="hidden"
                    name="stayDates.to"
                    value={field.state.value?.to}
                  />
                  <Calendar
                    className="p-0 min-h-100"
                    mode="range"
                    startMonth={addDays(new Date(), 1)}
                    endMonth={addMonths(new Date(), 12)}
                    disabled={[
                      booked.map((date) => new Date(date)),
                      ...Array.from({ length: 31 }, (_, i) =>
                        addDays(new Date(), -i),
                      ),
                    ]}
                    selected={{
                      from: field.state.value?.from
                        ? new Date(field.state.value?.from)
                        : undefined,
                      to: field.state.value?.to
                        ? new Date(field.state.value?.to)
                        : undefined,
                    }}
                    onSelect={(range) => {
                      field.handleChange({
                        from: range?.from ? range.from.toISOString() : "",
                        to: range?.to ? range.to.toISOString() : "",
                      });
                    }}
                  />
                  <FieldError errors={field.state.meta.errors} />
                </Field>
              )}
            </form.Field>
          </FieldSet>

          <Separator />

          <div>
            <p className="text-sm">
              {t.rich("form.pricePerNight", {
                price: formatter.number(pricePerNight, {
                  style: "currency",
                  currency: "EUR",
                  minimumFractionDigits: 0,
                }),
                strong: (chunks) => <strong>{chunks}</strong>,
              })}
            </p>

            <form.Subscribe>
              {(formState) => {
                console.log("formState.values.stayDates", formState);
                const totalNights =
                  formState.values.stayDates.from &&
                  formState.values.stayDates.to
                    ? Math.ceil(
                        (new Date(formState.values.stayDates.to).getTime() -
                          new Date(formState.values.stayDates.from).getTime()) /
                          (1000 * 60 * 60 * 24),
                      ) || 1
                    : 0;

                return (
                  <p className={cn("text-sm", !totalNights && "invisible")}>
                    {t.rich("form.totalPrice", {
                      pricePerNight: formatter.number(pricePerNight, {
                        style: "currency",
                        currency: "EUR",
                        minimumFractionDigits: 0,
                      }),
                      totalNights,
                      totalPrice: formatter.number(
                        pricePerNight * totalNights,
                        {
                          style: "currency",
                          currency: "EUR",
                          minimumFractionDigits: 0,
                        },
                      ),
                      strong: (chunks) => <strong>{chunks}</strong>,
                    })}
                  </p>
                );
              }}
            </form.Subscribe>
          </div>

          <FieldSet>
            <Button type="submit" disabled={isPending} size="lg">
              {isPending ? t("form.submitting") : t("form.submit")}
            </Button>
          </FieldSet>
        </FieldGroup>

        <FieldSet>
          <p className="text-xs text-pretty">{t("form.disclaimer")}</p>
        </FieldSet>
      </form>
    </div>
  );
}
