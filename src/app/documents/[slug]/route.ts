import { getDocumentBySlug } from "@/lib/documents/documents";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ slug: string }> },
) {
  const { slug: rawSlug } = await params;
  const slug = rawSlug.replace(/\.pdf$/, "");

  const doc = await getDocumentBySlug(slug);
  if (!doc) {
    return new Response("Not found", { status: 404 });
  }

  const upstream = await fetch(doc.fileUrl, { cache: "no-store" });
  if (!upstream.ok || !upstream.body) {
    return new Response("Document unavailable", { status: 502 });
  }

  const headers: Record<string, string> = {
    "Content-Type": "application/pdf",
    "Content-Disposition": `inline; filename="${slug}.pdf"`,
    "Cache-Control": "no-store",
  };

  const contentLength = upstream.headers.get("Content-Length");
  if (contentLength) {
    headers["Content-Length"] = contentLength;
  }

  return new Response(upstream.body, { headers });
}
