import type { ReactNode } from "react";

/**
 * Hook-free markup shared by the live <Header> and its Suspense fallback
 * (<HeaderSkeleton>). Both render through these pieces, so the fixed bar's box
 * — padding, grid, line boxes — is identical by construction and the real
 * header swaps in with no layout shift. Keep every class that affects size
 * here, not at the call sites.
 */

/** Size/shape of one locale link; the live links add focus styles on top. */
export const LANGUAGE_LINK_LAYOUT =
  "w-10 p-1 text-center rounded-full font-bold relative";

export function HeaderBar({
  telephone,
  telephoneDisplay,
  email,
  languageNav,
  actions,
}: {
  /** E.164 phone for the `tel:` link; empty string renders no phone. */
  telephone: string;
  /** Formatted phone for display. */
  telephoneDisplay: string;
  email: string;
  languageNav: ReactNode;
  actions: ReactNode;
}) {
  return (
    <header className="fixed bottom-0 left-0 w-full bg-olive-900 text-olive-50 z-10 p-6 md:px-0 md:grid md:grid-cols-[24px_1fr_1fr_1fr_1fr_1fr_1fr_1fr_1fr_1fr_1fr_1fr_1fr_24px] lg:grid-cols-[2fr_1fr_1fr_1fr_1fr_1fr_1fr_1fr_1fr_1fr_1fr_1fr_1fr_2fr] gap-4 md:items-center">
      <a
        href={`tel:${telephone}`}
        className="max-lg:hidden md:col-start-2 col-span-3"
      >
        {telephoneDisplay}
      </a>
      <a
        href={`mailto:${email}`}
        className="max-lg:hidden md:col-start-5 col-span-3"
      >
        {email}
      </a>
      {languageNav}
      <div className="md:contents flex gap-2">{actions}</div>
    </header>
  );
}

/** The desktop language pill's outer frame (`children` = its inner row). */
export function LanguageNavFrame({ children }: { children: ReactNode }) {
  return (
    <nav
      aria-label="Language"
      className="max-md:hidden md:col-start-2 lg:col-start-8 col-span-3 p-1 rounded-full bg-olive-800 justify-self-start"
    >
      {children}
    </nav>
  );
}
