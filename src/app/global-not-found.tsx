import type { Metadata } from "next";
import Link from "next/link";
import { Mulish, PT_Serif } from "next/font/google";
import { buttonVariants } from "@/components/ui/button";
import "./globals.css";

// App-level catch-all for unmatched URLs across BOTH root layouts (`[locale]` and
// `admin`). Required because the multiple-root-layout + top-level dynamic
// `[locale]` shape leaves no `app/layout.tsx` to host an `app/not-found.tsx`.
// Must be self-contained (own <html>/<body>, fonts, globals.css) and cannot read
// the request locale reliably, so the copy is English. See ADR-0011.
// Enabled via `experimental.globalNotFound` in next.config.ts.

const mulish = Mulish({
  variable: "--font-mulish",
  subsets: ["latin"],
  weight: ["400", "600", "700"],
});

const ptSerif = PT_Serif({
  variable: "--font-pt-serif",
  subsets: ["latin"],
  weight: ["400", "700"],
});

export const metadata: Metadata = {
  title: "Page not found · La Cour de Haut",
  description: "The page you are looking for does not exist.",
};

export default function GlobalNotFound() {
  return (
    <html
      lang="en"
      className={`${mulish.variable} ${ptSerif.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <main className="flex flex-col flex-1 items-center justify-center gap-8 p-6 py-12 text-center">
          <div className="space-y-4 max-w-md">
            <p className="text-style-eyebrow-large text-brand-moss">404</p>
            <h1 className="text-style-display-medium">Page not found</h1>
            <p className="text-style-body-large text-muted-foreground">
              Sorry, the page you are looking for doesn’t exist or has moved.
            </p>
          </div>
          {/* Links to "/" so the proxy re-negotiates the visitor's locale. */}
          <Link href="/" className={buttonVariants()}>
            Back to home
          </Link>
        </main>
      </body>
    </html>
  );
}
