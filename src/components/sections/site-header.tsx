import { Suspense, type ReactNode } from "react";
import { getSettings } from "@/lib/settings/settings";
import { formatPhoneDisplay, toE164 } from "@/lib/phone";
import { Header } from "./header";
import { HeaderSkeleton } from "./header-skeleton";

/**
 * Server wrapper that supplies the interactive client `Header` with the
 * owner-editable contact details (`/admin/settings`).
 *
 * The data read lives here — in one place — rather than in every page that
 * renders a header. `getSettings()` is `"use cache"`, so rendering this on
 * several pages still hits the DB once. Pages pass their own page-specific
 * `action` through unchanged.
 *
 * `Header` reads `usePathname()` (locale-switch links), which can't prerender,
 * so it sits in a Suspense boundary: the rest of the page prerenders fully and
 * the header streams in with the response. The fallback is the same bar with a
 * placeholder language switcher (see header-skeleton.tsx).
 *
 * The settings are required + seeded (see scripts/seed-property-settings.mts),
 * so in practice they're always present; the `?? ""` only guards the type
 * (`Settings` is partial) and degrades to an empty link rather than crashing.
 */
export async function SiteHeader({ action }: { action: ReactNode }) {
  const settings = await getSettings();
  const stored = settings.property_telephone ?? "";
  const email = settings.property_email ?? "";

  // E.164 for the tel: link, formatted for display — both derived from the
  // stored value so the owner can type it however they like.
  const telephone = stored ? toE164(stored) : "";
  const telephoneDisplay = stored ? formatPhoneDisplay(stored) : "";

  return (
    <Suspense
      fallback={
        <HeaderSkeleton
          action={action}
          telephone={telephone}
          telephoneDisplay={telephoneDisplay}
          email={email}
        />
      }
    >
      <Header
        action={action}
        telephone={telephone}
        telephoneDisplay={telephoneDisplay}
        email={email}
      />
    </Suspense>
  );
}
