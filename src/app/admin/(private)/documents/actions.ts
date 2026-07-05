"use server";

import { revalidatePath } from "next/cache";
import { verifySession } from "@/lib/auth/session";
import {
  createDocument,
  renameDocument,
  replaceDocumentFile,
  deleteDocument,
} from "@/lib/documents/documents";

// No updateTag here (unlike gallery/actions.ts) — documents are unlisted and
// nothing public reads them through a cached tag; the admin list itself is
// revalidated via the path.
function invalidate() {
  revalidatePath("/admin/documents");
}

export async function createDocumentAction(title: string, fileUrl: string) {
  await verifySession();
  const trimmedTitle = title.trim();
  if (!trimmedTitle) {
    throw new Error("Titel is verplicht");
  }
  if (!fileUrl) {
    throw new Error("Geen bestand geüpload");
  }
  await createDocument({ title: trimmedTitle, fileUrl });
  invalidate();
}

export async function renameDocumentAction(id: string, title: string) {
  await verifySession();
  const trimmedTitle = title.trim();
  if (!trimmedTitle) {
    throw new Error("Titel is verplicht");
  }
  await renameDocument(id, trimmedTitle);
  invalidate();
}

export async function replaceDocumentFileAction(id: string, fileUrl: string) {
  await verifySession();
  if (!fileUrl) {
    throw new Error("Geen bestand geüpload");
  }
  await replaceDocumentFile(id, fileUrl);
  invalidate();
}

export async function deleteDocumentAction(id: string) {
  await verifySession();
  await deleteDocument(id);
  invalidate();
}
