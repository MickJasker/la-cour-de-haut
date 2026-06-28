import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";

// Renders for an explicit `notFound()` in a private admin page (e.g. editing a
// review whose id no longer exists). Sits inside the sidebar layout, so the owner
// keeps the navigation. Admin has no I18nProvider — copy is hardcoded Dutch.
export default function AdminNotFound() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-6 p-8 text-center">
      <div className="space-y-2 max-w-md">
        <h1 className="text-2xl font-semibold">Pagina niet gevonden</h1>
        <p className="text-muted-foreground">
          Deze pagina bestaat niet (meer). Controleer de link of ga terug naar
          het dashboard.
        </p>
      </div>
      <Link href="/admin" className={buttonVariants()}>
        Naar dashboard
      </Link>
    </main>
  );
}
