import { Suspense, type ReactNode } from "react";
import { getSettings } from "@/lib/settings/settings";
import { formatPhoneDisplay, toE164 } from "@/lib/phone";
import { HeaderBar } from "./header-shell";
import { HeaderSpacer } from "./header-spacer";
import { LanguageNav, MobileLanguageMenu } from "./language-switcher";
import {
  LanguageNavSkeleton,
  MobileLanguageMenuSkeleton,
} from "./header-skeleton";

/**
 * Server component that builds the fixed header bar, supplying the owner-
 * editable contact details (`/admin/settings`).
 *
 * The data read lives here — in one place — rather than in every page that
 * renders a header. `getSettings()` is `"use cache"`, so rendering this on
 * several pages still hits the DB once. Pages pass their own page-specific
 * `action` through unchanged.
 *
 * Only the language switcher needs `usePathname()` (each locale's link swaps
 * the current path in), which can't prerender. So just those two pieces sit in
 * Suspense boundaries with skeleton fallbacks; the contact links and the `action`
 * stay in the static shell and hydrate with the page, so e.g. the booking CTA is
 * live (and opens its intercepted dialog) as soon as the page is interactive.
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
    <>
      <HeaderBar
        // E.164 for the tel: link, formatted for display — both derived from the
        // stored value so the owner can type it however they like.
        telephone={stored ? toE164(stored) : ""}
        telephoneDisplay={stored ? formatPhoneDisplay(stored) : ""}
        email={email}
        languageNav={
          <Suspense fallback={<LanguageNavSkeleton />}>
            <LanguageNav />
          </Suspense>
        }
        actions={
          <>
            {action}
            <Suspense fallback={<MobileLanguageMenuSkeleton />}>
              <MobileLanguageMenu />
            </Suspense>
          </>
        }
      />
      <HeaderSpacer />
    </>
  );
}
