"use client";

import { useEffect } from "react";
import Link from "next/link";
import { Button, buttonVariants } from "@/components/ui/button";

// Catches unexpected runtime errors in private admin pages (e.g. a DB failure in
// a server action's page render). Renders inside the sidebar layout. A failure in
// the sidebar layout itself bubbles past this boundary to `global-error`. Admin
// has no I18nProvider — copy is hardcoded Dutch. See ADR-0011.
export default function AdminError({
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
    <main className="flex min-h-screen flex-col items-center justify-center gap-6 p-8 text-center">
      <div className="space-y-2 max-w-md">
        <h1 className="text-2xl font-semibold">Er is iets misgegaan</h1>
        <p className="text-muted-foreground">
          Er is een onverwachte fout opgetreden. Probeer het opnieuw — blijft
          het misgaan, herlaad dan de pagina.
        </p>
      </div>
      <div className="flex flex-wrap items-center justify-center gap-3">
        <Button onClick={() => unstable_retry()}>Probeer opnieuw</Button>
        <Link
          href="/admin"
          className={buttonVariants({ variant: "secondary" })}
        >
          Naar dashboard
        </Link>
      </div>
    </main>
  );
}
