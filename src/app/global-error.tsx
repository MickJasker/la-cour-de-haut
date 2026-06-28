"use client";

import { useEffect } from "react";
import Link from "next/link";
import { Mulish, PT_Serif } from "next/font/google";
import { Button, buttonVariants } from "@/components/ui/button";
import "./globals.css";

// Last-resort boundary for failures in a root layout itself (`[locale]/layout.tsx`
// or `admin/layout.tsx`) — those bubble past the segment `error.tsx` files. It
// replaces the root layout when active, so it must render its own <html>/<body>,
// fonts and globals.css, and has no i18n context (English copy). No `metadata`
// export is allowed in a client component, so the title uses React's <title>.
// See ADR-0011.

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

export default function GlobalError({
  error,
  unstable_retry,
}: {
  error: Error & { digest?: string };
  unstable_retry: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <html
      lang="en"
      className={`${mulish.variable} ${ptSerif.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <title>Something went wrong · La Cour de Haut</title>
        <main className="flex flex-col flex-1 items-center justify-center gap-8 p-6 py-12 text-center">
          <div className="space-y-4 max-w-md">
            <h1 className="text-style-display-medium">Something went wrong</h1>
            <p className="text-style-body-large text-muted-foreground">
              An unexpected error occurred. Please try again — if the problem
              persists, contact us by email or phone.
            </p>
          </div>
          <div className="flex flex-wrap items-center justify-center gap-3">
            <Button onClick={() => unstable_retry()}>Try again</Button>
            <Link href="/" className={buttonVariants({ variant: "secondary" })}>
              Back to home
            </Link>
          </div>
        </main>
      </body>
    </html>
  );
}
