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
import {
  isCalendarDayDisabled,
  pendingArrival,
} from "@/lib/booking/calendar-disabled";

const renderStrong = (chunks: ReactNode) => <strong>{chunks}</strong>;
import { Separator } from "../ui/separator";
import { Turnstile, type TurnstileInstance } from "@marsidev/react-turnstile";
import {
  submitBookingAction,
  type BookingActionState,
} from "@/app/[locale]/book/action";
import {
  calculatePriceBreakdown,
  calculateTotalNights,
  formOpts,
  paymentScheduleRows,
  type BookingPaymentConfig,
} from "@/app/[locale]/book/shared";
import { createBookingFormSchema } from "@/app/[locale]/book/shared";
import { computePaymentSchedule } from "@/lib/booking/payment-schedule";
import { CountryCombobox } from "@/components/ui/country-combobox";
import { PhoneInput } from "@/components/ui/phone-input";
import { LOCALE_DEFAULT_COUNTRY } from "@/lib/countries";

export function BookForm({
  bookedDates,
  pricePerNight: pricePerNightPromise,
  paymentConfig: paymentConfigPromise,
  stickyCta = false,
}: {
  bookedDates: Promise<string[]>;
  pricePerNight: Promise<number>;
  paymentConfig: Promise<BookingPaymentConfig>;
  /** Pins the total + submit button to the bottom of the nearest scroll
      container (the booking dialog); the full price breakdown stays in flow. */
  stickyCta?: boolean;
}) {
  const t = useTranslations("booking");
  const locale = useLocale();

  // Busy NIGHTS as yyyy-MM-dd strings (end-exclusive intervals): for a
  // booking 13 → 15 Aug this contains the 13th and 14th only.
  const bookedNights = new Set(use(bookedDates));
  const pricePerNight = use(pricePerNightPromise);
  const paymentConfig = use(paymentConfigPromise);

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

  // Locale-formatted deadline dates for the payment-schedule breakdown.
  const dateFormatter = new Intl.DateTimeFormat(locale, {
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  const isSuccessful = state.success;

  return (
    <div className="relative">
      <form
        action={formAction}
        noValidate
        className="w-full max-w-2xl space-y-6"
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
                      // Half-day role model (issue #183): which days are
                      // disabled depends on what the NEXT click selects —
                      // an arrival (no pending selection, or a full range
                      // that the click restarts) or a departure (arrival
                      // picked, departure not yet). A changeover day is
                      // selectable as departure only.
                      (date: Date) =>
                        isCalendarDayDisabled(
                          bookedNights,
                          format(date, "yyyy-MM-dd"),
                          pendingArrival(
                            field.state.value?.from,
                            field.state.value?.to,
                          ),
                        ),
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
            <p className="text-md">
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

                // "Today" plays the confirm-date role for the preview: the
                // owner hasn't confirmed yet, so the schedule is computed as if
                // confirmation happened now. Read client-side (like the calendar
                // and min-nights validation) — the rows only appear after a
                // date selection, a post-hydration interaction, so there is no
                // server/client "today" to disagree on.
                const arrival = formState.values.stayDates?.from ?? "";
                const scheduleRows =
                  totalNights && arrival
                    ? paymentScheduleRows(
                        computePaymentSchedule(
                          totalPrice,
                          paymentConfig.securityDeposit,
                          format(new Date(), "yyyy-MM-dd"),
                          arrival,
                          paymentConfig.settings,
                        ),
                        paymentConfig.settings,
                        paymentConfig.securityDeposit,
                      )
                    : [];

                return (
                  <>
                    <div
                      className={cn(
                        "text-md space-y-0.5",
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
                      {discount > 0 && (
                        <p className="text-positive">
                          {t.rich("form.longStayDiscount", {
                            discount: currency.format(discount),
                            strong: renderStrong,
                          })}
                        </p>
                      )}
                      <p>
                        {t.rich("form.tourismTaxLine", {
                          tourismTax: currency.format(tourismTax),
                          strong: renderStrong,
                        })}
                      </p>
                      {/* In sticky mode the total lives in the CTA bar below;
                          repeating it here reads as a duplicate at rest. */}
                      {!stickyCta && (
                        <p className="font-medium">
                          {t.rich("form.totalLine", {
                            totalPrice: currency.format(totalPrice),
                            strong: renderStrong,
                          })}
                        </p>
                      )}

                      {scheduleRows.length > 0 && (
                        <div className="mt-3 space-y-0.5 border-t border-border pt-3">
                          <p className="font-medium">
                            {t("form.paymentSchedule.heading")}
                          </p>
                          {scheduleRows.map((row) => {
                            if (row.kind === "deposit") {
                              return (
                                <p key="deposit">
                                  {t.rich("form.paymentSchedule.deposit", {
                                    percentage: row.percentage,
                                    amount: currency.format(row.amount),
                                    days: row.dueWithinDays,
                                    strong: renderStrong,
                                  })}
                                </p>
                              );
                            }
                            if (row.kind === "balance") {
                              return (
                                <p key="balance">
                                  {t.rich(
                                    row.includesBorg
                                      ? "form.paymentSchedule.balanceWithBorg"
                                      : "form.paymentSchedule.balance",
                                    {
                                      amount: currency.format(row.amount),
                                      days: row.dueDaysBeforeArrival,
                                      date: dateFormatter.format(
                                        new Date(row.deadline + "T00:00:00"),
                                      ),
                                      strong: renderStrong,
                                    },
                                  )}
                                </p>
                              );
                            }
                            return (
                              <p key="total">
                                {t.rich(
                                  row.includesBorg
                                    ? "form.paymentSchedule.totalWithBorg"
                                    : "form.paymentSchedule.total",
                                  {
                                    amount: currency.format(row.amount),
                                    strong: renderStrong,
                                  },
                                )}
                              </p>
                            );
                          })}
                          {paymentConfig.securityDeposit > 0 && (
                            <p className="text-sm text-muted-foreground">
                              {t.rich("form.paymentSchedule.borgNote", {
                                amount: currency.format(
                                  paymentConfig.securityDeposit,
                                ),
                                strong: renderStrong,
                              })}
                            </p>
                          )}
                        </div>
                      )}
                    </div>
                  </>
                );
              }}
            </form.Subscribe>
            <p className="text-sm text-muted-foreground">
              {t("form.price_includes")}
            </p>
          </div>

          {/* -bottom-10 cancels the dialog scroll container's pb-10: sticky
              offsets resolve against the scrollport's content box, so without
              it the bar floats above the dialog edge with content visible
              underneath. */}
          <div
            className={cn(
              stickyCta &&
                "sticky -bottom-10 z-10 border-t border-border bg-background py-4",
            )}
          >
            <FieldSet className={cn(stickyCta && "gap-3")}>
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

              {stickyCta && (
                <form.Subscribe>
                  {(formState) => {
                    const totalNights = calculateTotalNights(
                      formState.values.stayDates?.from ?? "",
                      formState.values.stayDates?.to ?? "",
                    );

                    if (!totalNights) return null;

                    const { totalPrice } = calculatePriceBreakdown(
                      pricePerNight,
                      totalNights,
                      Number(formState.values.guestCount),
                    );

                    return (
                      <p className="text-md">
                        {t.rich("form.totalLine", {
                          totalPrice: currency.format(totalPrice),
                          strong: renderStrong,
                        })}
                      </p>
                    );
                  }}
                </form.Subscribe>
              )}

              <div className="relative flex flex-col items-center">
                {isSuccessful ? (
                  <div className="flex items-center justify-center h-10 bg-positive w-full rounded-md text-olive-50">
                    <p className="text-style-body-large font-semibold!">
                      {t("form.successMessage")}
                    </p>
                  </div>
                ) : (
                  <Button
                    type="submit"
                    disabled={isPending}
                    className="w-full"
                    size="lg"
                  >
                    {isPending ? t("form.submitting") : t("form.submit")}
                  </Button>
                )}
              </div>
            </FieldSet>
          </div>
        </FieldGroup>

        <FieldSet>
          <p className="text-xs text-pretty">{t("form.disclaimer")}</p>

          <p className="text-xs text-muted-foreground">
            {t.rich("consentNotice", {
              terms: (chunks: ReactNode) => (
                <Link
                  href="/terms"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="underline underline-offset-2 hover:text-foreground transition-colors"
                >
                  {chunks}
                </Link>
              ),
              privacy: (chunks: ReactNode) => (
                <Link
                  href="/privacy"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="underline underline-offset-2 hover:text-foreground transition-colors"
                >
                  {chunks}
                </Link>
              ),
            })}
          </p>
        </FieldSet>
      </form>
    </div>
  );
}
