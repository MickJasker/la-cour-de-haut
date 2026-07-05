"use client";

import { useState, useTransition, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { uploadAdminDocument } from "../upload-file";
import {
  createDocumentAction,
  renameDocumentAction,
  replaceDocumentFileAction,
  deleteDocumentAction,
} from "./actions";
import type { document } from "@/db/schema";

// Row variables are always named `doc`, never `document` — this file runs in
// the browser where `document` is the DOM global.
type Doc = typeof document.$inferSelect;

function CopyButton({ value }: { value: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      onClick={() => {
        void navigator.clipboard.writeText(value).then(() => {
          setCopied(true);
          setTimeout(() => setCopied(false), 2000);
        });
      }}
    >
      {copied ? "Gekopieerd!" : "Link kopiëren"}
    </Button>
  );
}

function DocumentRow({
  doc,
  appUrl,
  onDelete,
}: {
  doc: Doc;
  appUrl: string;
  onDelete: (id: string) => void;
}) {
  const [isPending, startTransition] = useTransition();
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [titleDraft, setTitleDraft] = useState(doc.title);
  const [replaceError, setReplaceError] = useState<string | null>(null);

  const publicUrl = `${appUrl}/documents/${doc.slug}.pdf`;
  const replaceInputId = `document-replace-${doc.id}`;

  function handleRenameSave() {
    const trimmed = titleDraft.trim();
    if (!trimmed) return;
    startTransition(async () => {
      await renameDocumentAction(doc.id, trimmed);
      setIsEditingTitle(false);
    });
  }

  function handleRenameCancel() {
    setTitleDraft(doc.title);
    setIsEditingTitle(false);
  }

  function handleReplaceFile(file: File) {
    if (file.type !== "application/pdf") {
      setReplaceError("Alleen PDF-bestanden zijn toegestaan.");
      return;
    }
    setReplaceError(null);
    startTransition(async () => {
      const url = await uploadAdminDocument(file);
      await replaceDocumentFileAction(doc.id, url);
    });
  }

  function handleDelete() {
    if (
      !confirm(
        `Document "${doc.title}" verwijderen? De link werkt dan niet meer.`,
      )
    )
      return;
    onDelete(doc.id);
    startTransition(() => {
      void deleteDocumentAction(doc.id);
    });
  }

  return (
    <li
      data-testid={`document-row-${doc.id}`}
      className="flex flex-wrap items-center gap-4 rounded-md border border-stone-200 bg-cream-50 p-4 md:flex-nowrap"
    >
      <div className="min-w-0 flex-1 space-y-1">
        {isEditingTitle ? (
          <div className="flex flex-wrap items-center gap-2">
            <Input
              value={titleDraft}
              onChange={(e) => setTitleDraft(e.target.value)}
              disabled={isPending}
              aria-label="Titel"
              className="h-8 w-auto max-w-xs"
            />
            <Button
              type="button"
              size="sm"
              disabled={isPending || titleDraft.trim() === ""}
              onClick={handleRenameSave}
            >
              Opslaan
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              disabled={isPending}
              onClick={handleRenameCancel}
            >
              Annuleren
            </Button>
          </div>
        ) : (
          <div className="flex flex-wrap items-center gap-2">
            <p className="truncate text-sm font-medium">{doc.title}</p>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              disabled={isPending}
              onClick={() => setIsEditingTitle(true)}
            >
              Hernoemen
            </Button>
          </div>
        )}
        <p className="truncate font-mono text-xs text-stone-500">{publicUrl}</p>
        {replaceError && (
          <p className="text-xs text-destructive">{replaceError}</p>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-2 md:shrink-0 md:flex-nowrap">
        <CopyButton value={publicUrl} />

        <Button variant="ghost" size="sm" disabled={isPending} asChild>
          <label htmlFor={replaceInputId} className="cursor-pointer">
            Vervangen
          </label>
        </Button>
        <input
          id={replaceInputId}
          data-testid={`document-replace-input-${doc.id}`}
          type="file"
          accept="application/pdf"
          className="hidden"
          disabled={isPending}
          onChange={(e) => {
            const file = e.target.files?.[0];
            e.target.value = "";
            if (file) handleReplaceFile(file);
          }}
        />

        <Button
          type="button"
          variant="ghost"
          size="sm"
          disabled={isPending}
          onClick={handleDelete}
        >
          Verwijderen
        </Button>
      </div>
    </li>
  );
}

export function DocumentList({
  docs,
  appUrl,
}: {
  docs: Doc[];
  appUrl: string;
}) {
  const [serverDocs, setServerDocs] = useState(docs);
  const [items, setItems] = useState(docs);

  // Sync with updated server props (e.g. after an action revalidates the
  // page). Updating state during render is React's recommended alternative
  // to useEffect+setState, which would cost an extra render cycle — same
  // pattern as GalleryList in ../gallery/gallery-client.tsx.
  if (serverDocs !== docs) {
    setServerDocs(docs);
    setItems(docs);
  }

  function handleDelete(id: string) {
    setItems((prev) => prev.filter((doc) => doc.id !== id));
  }

  if (items.length === 0) {
    return (
      <p className="text-sm text-stone-500">
        Nog geen documenten geüpload. Voeg er hieronder een toe om te beginnen.
      </p>
    );
  }

  return (
    <ul data-testid="document-list" className="space-y-2">
      {items.map((doc) => (
        <DocumentRow
          key={doc.id}
          doc={doc}
          appUrl={appUrl}
          onDelete={handleDelete}
        />
      ))}
    </ul>
  );
}

export function UploadForm() {
  const [title, setTitle] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleFileChange(list: FileList | null) {
    const selected = list?.[0];
    if (!selected) {
      setFile(null);
      return;
    }
    if (selected.type !== "application/pdf") {
      setError("Alleen PDF-bestanden zijn toegestaan.");
      setFile(null);
      return;
    }
    setError(null);
    setFile(selected);
  }

  function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const trimmedTitle = title.trim();
    if (!trimmedTitle || !file) return;
    const fileToUpload = file;
    // startTransition is required so Next.js sends back updated RSC after
    // the server action and re-renders DocumentList with the new document.
    startTransition(async () => {
      const url = await uploadAdminDocument(fileToUpload);
      await createDocumentAction(trimmedTitle, url);
      setTitle("");
      setFile(null);
    });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <div className="flex flex-wrap items-end gap-3">
        <div className="min-w-[200px] flex-1 space-y-1">
          <Label htmlFor="document-title">Titel</Label>
          <Input
            id="document-title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Huisregels"
            required
            disabled={isPending}
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor="document-file-input">PDF</Label>
          <Input
            id="document-file-input"
            data-testid="document-file-input"
            type="file"
            accept="application/pdf"
            onChange={(e) => handleFileChange(e.target.files)}
            disabled={isPending}
          />
        </div>
        <Button type="submit" disabled={isPending || !title.trim() || !file}>
          {isPending ? "Uploaden…" : "Uploaden"}
        </Button>
      </div>
      {error && <p className="text-sm text-destructive">{error}</p>}
    </form>
  );
}
