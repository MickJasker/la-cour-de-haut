"use client";
import {
  initialFormState,
  mergeForm,
  revalidateLogic,
  useForm,
  useTransform,
} from "@tanstack/react-form-nextjs";
import { use, useActionState, useRef, useState } from "react";
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
import { addDays, addMonths, format } from "date-fns";
import { Calendar } from "../ui/calendar";
import { useLocale, useTranslations } from "@/i18n/provider";
import { Link } from "@/i18n/navigation";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { FORWARD_HORIZON_MONTHS } from "@/lib/booking/calendar-day";

const renderStrong = (chunks: ReactNode) => <strong>{chunks}</strong>;
import { Separator } from "../ui/separator";
import { CircleCheckBig } from "lucide-react";
import { Turnstile, type TurnstileInstance } from "@marsidev/react-turnstile";
import {
  submitBookingAction,
  type BookingActionState,
} from "@/app/[locale]/book/action";
import {
  calculatePriceBreakdown,
  calculateTotalNights,
  formOpts,
} from "@/app/[locale]/book/shared";
import { createBookingFormSchema } from "@/app/[locale]/book/shared";
import { CountryCombobox } from "@/components/ui/country-combobox";
import { PhoneInput } from "@/components/ui/phone-input";
import { LOCALE_DEFAULT_COUNTRY } from "@/lib/countries";

export function BookForm({
  bookedDates,
  pricePerNight: pricePerNightPromise,
}: {
  bookedDates: Promise<string[]>;
  pricePerNight: Promise<number>;
}) {
  const t = useTranslations("booking");
  const locale = useLocale();

  const booked = use(bookedDates);
  const pricePerNight = use(pricePerNightPromise);

  const [turnstileToken, setTurnstileToken] = useState("");
  const turnstileRef = useRef<TurnstileInstance>(null);

  const [state, formAction, isPending] = useActionState<
    BookingActionState,
    FormData
  >(submitBookingAction, { ...initialFormState, success: false });

  const form = useForm({
    ...formOpts,
    defaultValues: {
      ...formOpts.defaultValues,
      country: LOCALE_DEFAULT_COUNTRY[locale] ?? "",
    },
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

  const currency = new Intl.NumberFormat(locale, {
    style: "currency",
    currency: "EUR",
    minimumFractionDigits: 0,
  });

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
        <Button
          variant="secondary"
          onClick={() => window.location.assign(`/${locale}/book`)}
        >
          {t("form.makeAnotherBooking")}
        </Button>
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
                  {/* Hidden input carries the composed E.164 value into FormData
                      for the server action, mirroring the country field. */}
                  <input
                    type="hidden"
                    name={field.name}
                    value={field.state.value}
                  />
                  <PhoneInput
                    id="phone"
                    locale={locale}
                    defaultCountry={LOCALE_DEFAULT_COUNTRY[locale] ?? "FR"}
                    value={field.state.value}
                    onChange={(value) => field.handleChange(value)}
                    onBlur={field.handleBlur}
                    countryLabel={t("form.phoneCountryLabel")}
                    searchPlaceholder={t("form.countrySearchPlaceholder")}
                    emptyText={t("form.countryEmpty")}
                    aria-invalid={field.state.meta.errors.length > 0}
                  />
                  <FieldError errors={field.state.meta.errors} />
                </Field>
              )}
            </form.Field>
          </FieldSet>

          <FieldSet>
            <form.Field name="address">
              {(field) => (
                <Field>
                  <FieldLabel htmlFor="address">{t("form.address")}</FieldLabel>
                  <Input
                    id="address"
                    type="text"
                    autoComplete="street-address"
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
            <form.Field name="postalCode">
              {(field) => (
                <Field>
                  <FieldLabel htmlFor="postalCode">
                    {t("form.postalCode")}
                  </FieldLabel>
                  <Input
                    id="postalCode"
                    type="text"
                    autoComplete="postal-code"
                    name={field.name}
                    value={field.state.value}
                    onChange={(e) => field.handleChange(e.target.value)}
                    onBlur={field.handleBlur}
                  />
                  <FieldError errors={field.state.meta.errors} />
                </Field>
              )}
            </form.Field>

            <form.Field name="city">
              {(field) => (
                <Field>
                  <FieldLabel htmlFor="city">{t("form.city")}</FieldLabel>
                  <Input
                    id="city"
                    type="text"
                    autoComplete="address-level2"
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

          <FieldSet>
            <form.Field name="country">
              {(field) => (
                <Field>
                  <FieldLabel htmlFor="country">{t("form.country")}</FieldLabel>
                  {/* Hidden input carries the ISO code into FormData for the
                      server action, mirroring the stayDates pattern above. */}
                  <input
                    type="hidden"
                    name={field.name}
                    value={field.state.value}
                  />
                  <CountryCombobox
                    id="country"
                    locale={locale}
                    value={field.state.value}
                    onChange={(code) => field.handleChange(code)}
                    onBlur={field.handleBlur}
                    placeholder={t("form.countryPlaceholder")}
                    searchPlaceholder={t("form.countrySearchPlaceholder")}
                    emptyText={t("form.countryEmpty")}
                    aria-invalid={field.state.meta.errors.length > 0}
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
                  <FieldLabel>{t("form.guestCount")}</FieldLabel>
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
                  <FieldLabel>{t("form.stayDates")}</FieldLabel>
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
                    excludeDisabled
                    startMonth={addDays(new Date(), 1)}
                    endMonth={addMonths(new Date(), FORWARD_HORIZON_MONTHS)}
                    disabled={[
                      booked.map((date) => new Date(date + "T00:00:00")),
                      ...Array.from({ length: 31 }, (_, i) =>
                        addDays(new Date(), -i),
                      ),
                    ]}
                    selected={{
                      from: field.state.value?.from
                        ? new Date(field.state.value.from + "T00:00:00")
                        : undefined,
                      to: field.state.value?.to
                        ? new Date(field.state.value.to + "T00:00:00")
                        : undefined,
                    }}
                    onSelect={(range) => {
                      field.handleChange({
                        from: range?.from
                          ? format(range.from, "yyyy-MM-dd")
                          : "",
                        to: range?.to ? format(range.to, "yyyy-MM-dd") : "",
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
                price: currency.format(pricePerNight),
              })}
            </p>

            <form.Subscribe>
              {(formState) => {
                const totalNights = calculateTotalNights(
                  formState.values.stayDates?.from ?? "",
                  formState.values.stayDates?.to ?? "",
                );

                const { rentalSubtotal, discount, tourismTax, totalPrice } =
                  calculatePriceBreakdown(
                    pricePerNight,
                    totalNights,
                    Number(formState.values.guestCount),
                  );

                return (
                  <>
                    {discount > 0 ? (
                      <div
                        className={cn(
                          "text-sm space-y-0.5",
                          !totalNights && "invisible",
                        )}
                      >
                        <p>
                          {t.rich("form.rentalSubtotalLine", {
                            pricePerNight: currency.format(pricePerNight),
                            totalNights,
                            rentalSubtotal: currency.format(rentalSubtotal),
                            strong: renderStrong,
                          })}
                        </p>
                        <p className="text-positive">
                          {t.rich("form.longStayDiscount", {
                            discount: currency.format(discount),
                            strong: renderStrong,
                          })}
                        </p>
                        <p>
                          {t.rich("form.tourismTaxLine", {
                            tourismTax: currency.format(tourismTax),
                            strong: renderStrong,
                          })}
                        </p>
                        <p className="font-medium">
                          {t.rich("form.totalLine", {
                            totalPrice: currency.format(totalPrice),
                            strong: renderStrong,
                          })}
                        </p>
                      </div>
                    ) : (
                      <p className={cn("text-sm", !totalNights && "invisible")}>
                        {t.rich("form.totalPrice", {
                          pricePerNight: currency.format(pricePerNight),
                          totalNights,
                          totalPrice: currency.format(totalPrice),
                          tourismTax: currency.format(tourismTax),
                        })}
                      </p>
                    )}
                  </>
                );
              }}
            </form.Subscribe>
            <p className="text-sm text-muted-foreground">
              {t("form.price_includes")}
            </p>
          </div>

          <FieldSet>
            <input type="hidden" name="_locale" value={locale} />
            {/* Honeypot: off-screen, hidden from assistive tech and keyboard nav */}
            <div
              aria-hidden="true"
              style={{ position: "absolute", left: "-9999px", top: "auto" }}
            >
              <input
                type="text"
                name="website"
                tabIndex={-1}
                autoComplete="off"
              />
            </div>

            <Turnstile
              ref={turnstileRef}
              siteKey={(
                process.env.NEXT_PUBLIC_CLOUDFLARE_TURNSTILE_SITE_KEY ?? ""
              ).trim()}
              options={{ size: "invisible", execution: "render" }}
              onSuccess={setTurnstileToken}
              onExpire={() => {
                setTurnstileToken("");
                turnstileRef.current?.reset();
              }}
            />
            <input
              type="hidden"
              name="cf-turnstile-response"
              value={turnstileToken}
            />

            {state.formError && (
              <p className="text-sm text-destructive">{state.formError}</p>
            )}

            <Button type="submit" disabled={isPending} size="lg">
              {isPending ? t("form.submitting") : t("form.submit")}
            </Button>

            <p className="text-xs text-muted-foreground">
              {t.rich("privacyNotice", {
                link: (chunks: ReactNode) => (
                  <Link
                    href="/privacy"
                    className="underline underline-offset-2 hover:text-foreground transition-colors"
                  >
                    {chunks}
                  </Link>
                ),
              })}
            </p>
          </FieldSet>
        </FieldGroup>

        <FieldSet>
          <p className="text-xs text-pretty">{t("form.disclaimer")}</p>
        </FieldSet>
      </form>
    </div>
  );
}
