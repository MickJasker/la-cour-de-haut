import { verifySession } from "@/lib/auth/session";
import { listDocuments } from "@/lib/documents/documents";
import { DocumentList, UploadForm } from "./documents-client";

export default async function DocumentsAdminPage() {
  await verifySession();
  const docs = await listDocuments();

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://lacourdehaut.fr";

  return (
    <main className="min-h-screen p-8">
      <div className="max-w-3xl mx-auto space-y-8">
        <div>
          <h1 className="text-2xl font-semibold">Documenten</h1>
          <p className="text-sm text-stone-500 mt-1">
            Upload een PDF en deel de link met gasten via e-mail. De link blijft
            hetzelfde, ook als je het bestand later vervangt.
          </p>
        </div>

        <section className="space-y-4">
          <h2 className="text-lg font-medium">Document toevoegen</h2>
          <UploadForm />
        </section>

        <section className="space-y-4">
          <h2 className="text-lg font-medium">Documenten</h2>
          <DocumentList docs={docs} appUrl={appUrl} />
        </section>
      </div>
    </main>
  );
}
