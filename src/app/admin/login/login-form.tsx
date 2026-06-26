"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { revalidateLogic, useForm } from "@tanstack/react-form-nextjs";
import { authClient } from "@/lib/auth-client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Field,
  FieldError,
  FieldGroup,
  FieldLabel,
  FieldSet,
} from "@/components/ui/field";
import { z } from "zod";

const schema = z.object({
  email: z.email("Ongeldig e-mailadres"),
  password: z.string().min(1, "Wachtwoord is verplicht"),
});

export function LoginForm() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);

  const form = useForm({
    defaultValues: { email: "", password: "" },
    validators: {
      onDynamic: schema,
    },
    validationLogic: revalidateLogic({
      mode: "submit",
      modeAfterSubmission: "change",
    }),
    onSubmit: async ({ value }) => {
      setError(null);
      const { error } = await authClient.signIn.email({
        email: value.email,
        password: value.password,
      });
      if (error) {
        setError("Ongeldig e-mailadres of wachtwoord.");
        return;
      }
      router.push("/admin");
      router.refresh();
    },
  });

  return (
    <main className="min-h-screen flex items-center justify-center">
      <div className="w-full max-w-sm space-y-6">
        <h1 className="text-style-display-medium text-center">
          Beheerder aanmelden
        </h1>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            form.handleSubmit();
          }}
          noValidate
        >
          <FieldGroup>
            <FieldSet>
              <form.Field name="email">
                {(field) => (
                  <Field>
                    <FieldLabel htmlFor={field.name}>E-mailadres</FieldLabel>
                    <Input
                      id={field.name}
                      type="email"
                      autoComplete="email"
                      required
                      value={field.state.value}
                      onChange={(e) => field.handleChange(e.target.value)}
                      onBlur={field.handleBlur}
                    />

                    <FieldError errors={field.state.meta.errors} />
                  </Field>
                )}
              </form.Field>

              <form.Field name="password">
                {(field) => (
                  <Field>
                    <FieldLabel htmlFor={field.name}>Wachtwoord</FieldLabel>
                    <Input
                      id={field.name}
                      type="password"
                      autoComplete="current-password"
                      required
                      value={field.state.value}
                      onChange={(e) => field.handleChange(e.target.value)}
                      onBlur={field.handleBlur}
                    />
                    <FieldError errors={field.state.meta.errors} />
                  </Field>
                )}
              </form.Field>

              {error && (
                <p role="alert" className="text-sm text-red-600">
                  {error}
                </p>
              )}
            </FieldSet>

            <form.Subscribe selector={(s) => s.isSubmitting}>
              {(isSubmitting) => (
                <FieldSet>
                  <Button
                    type="submit"
                    disabled={isSubmitting}
                    className="w-full"
                  >
                    {isSubmitting ? "Aanmelden…" : "Aanmelden"}
                  </Button>
                </FieldSet>
              )}
            </form.Subscribe>
          </FieldGroup>
        </form>
      </div>
    </main>
  );
}
