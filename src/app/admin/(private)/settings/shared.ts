import { formOptions } from "@tanstack/react-form-nextjs";
import { z } from "zod";
import {
  settingsRegistry,
  type SettingKey,
  type ClientShape,
} from "@/lib/settings/registry";

// Cast is safe: Object.fromEntries loses per-key types but ClientShape
// captures them. The runtime shape is identical to the static assertion.
export const settingsFormClientSchema = z.object(
  Object.fromEntries(
    Object.entries(settingsRegistry).map(([key, def]) => [
      key,
      def.clientValidation,
    ]),
  ) as ClientShape,
);

// Server receives strings for all fields; validation is identical to client.
export const settingsFormServerSchema = settingsFormClientSchema;

export type SettingsFormValues = z.infer<typeof settingsFormClientSchema>;

const defaultValues = Object.fromEntries(
  Object.keys(settingsRegistry).map((key) => [key, ""]),
) as Record<SettingKey, string>;

export const settingsFormOpts = formOptions({
  defaultValues,
});
