import type { ReactNode } from "react";
import { getSettings } from "@/lib/settings/settings";
import { formatPhoneDisplay, toE164 } from "@/lib/phone";
import { Header } from "./header";

/**
 * Server wrapper that supplies the interactive client `Header` with the
 * owner-editable contact details (`/admin/settings`).
 *
 * The data read lives here — in one place — rather than in every page that
 * renders a header. `getSettings()` is `"use cache"`, so rendering this on
 * several pages still hits the DB once. Pages pass their own page-specific
 * `action` through unchanged.
 *
 * The settings are required + seeded (see scripts/seed-property-settings.mts),
 * so in practice they're always present; the `?? ""` only guards the type
 * (`Settings` is partial) and degrades to an empty link rather than crashing.
 */
export async function SiteHeader({ action }: { action: ReactNode }) {
  const settings = await getSettings();
  const stored = settings.property_telephone ?? "";
  const email = settings.property_email ?? "";

  return (
    <Header
      action={action}
      // E.164 for the tel: link, formatted for display — both derived from the
      // stored value so the owner can type it however they like.
      telephone={stored ? toE164(stored) : ""}
      telephoneDisplay={stored ? formatPhoneDisplay(stored) : ""}
      email={email}
    />
  );
}
