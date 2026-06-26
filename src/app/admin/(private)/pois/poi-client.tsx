"use client";

import { useTransition, useState, useId } from "react";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import {
  createPoiAction,
  updatePoiAction,
  togglePoiPublishedAction,
  deletePoiAction,
} from "./actions";
import type { poi } from "@/db/schema";

type Poi = typeof poi.$inferSelect;

function PoiForm({
  editing,
  onCancel,
  onSaved,
}: {
  editing: Poi | null;
  onCancel: () => void;
  onSaved: () => void;
}) {
  const [isPending, startTransition] = useTransition();
  const [file, setFile] = useState<File | null>(null);
  const [published, setPublished] = useState(editing?.published ?? false);
  const titleId = useId();
  const bodyId = useId();
  const distanceId = useId();
  const sortOrderId = useId();
  const publishedId = useId();

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const data = new FormData(form);
    if (file) data.set("file", file);

    startTransition(async () => {
      if (editing) {
        await updatePoiAction(editing.id, data);
      } else {
        await createPoiAction(data);
        form.reset();
        setFile(null);
      }
      onSaved();
    });
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="space-y-4 border border-stone-200 rounded-lg p-5 bg-stone-50"
    >
      <h2 className="text-sm font-semibold text-stone-700">
        {editing ? "POI bewerken" : "Nieuwe POI toevoegen"}
      </h2>

      <div className="space-y-1">
        <Label htmlFor={titleId}>Titel</Label>
        <input
          id={titleId}
          name="title"
          required
          defaultValue={editing?.title ?? ""}
          className="w-full rounded border border-stone-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
        />
      </div>

      <div className="space-y-1">
        <Label htmlFor={bodyId}>Beschrijving</Label>
        <textarea
          id={bodyId}
          name="body"
          required
          rows={3}
          defaultValue={editing?.body ?? ""}
          className="w-full rounded border border-stone-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1">
          <Label htmlFor={distanceId}>Afstand (km)</Label>
          <input
            id={distanceId}
            name="distanceKm"
            type="number"
            min={0}
            defaultValue={editing?.distanceKm ?? ""}
            className="w-full rounded border border-stone-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor={sortOrderId}>Volgorde</Label>
          <input
            id={sortOrderId}
            name="sortOrder"
            type="number"
            defaultValue={editing?.sortOrder ?? 0}
            className="w-full rounded border border-stone-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
          />
        </div>
      </div>

      <div className="space-y-1">
        <Label>Afbeelding{editing ? " (leeg laten om te behouden)" : ""}</Label>
        <input
          data-testid="poi-file-input"
          type="file"
          accept="image/*"
          required={!editing}
          onChange={(e) => setFile(e.target.files?.[0] ?? null)}
          className="block text-sm text-stone-600"
        />
        {editing && (
          <div className="relative w-16 h-16 mt-1">
            <Image
              src={editing.imageUrl}
              alt={editing.title}
              fill
              className="object-cover rounded"
              sizes="64px"
            />
          </div>
        )}
      </div>

      <input
        type="hidden"
        name="published"
        value={published ? "true" : "false"}
      />
      <div className="flex items-center gap-2">
        <Checkbox
          id={publishedId}
          checked={published}
          onCheckedChange={(checked) => setPublished(checked === true)}
        />
        <Label htmlFor={publishedId}>Gepubliceerd</Label>
      </div>

      <div className="flex gap-2">
        <Button type="submit" disabled={isPending}>
          {isPending ? "Opslaan…" : "Opslaan"}
        </Button>
        {editing && (
          <Button type="button" variant="ghost" onClick={onCancel}>
            Annuleren
          </Button>
        )}
      </div>
    </form>
  );
}

function PoiRow({
  item,
  onDelete,
  onEdit,
}: {
  item: Poi;
  onDelete: (id: string) => void;
  onEdit: (item: Poi) => void;
}) {
  const [isPending, startTransition] = useTransition();
  const [published, setPublished] = useState(item.published);

  return (
    <li
      data-testid={`poi-row-${item.id}`}
      className="flex items-center gap-4 rounded-md border border-stone-200 bg-white p-3"
    >
      <div className="relative w-16 h-16 shrink-0">
        <Image
          src={item.imageUrl}
          alt={item.title}
          fill
          className="object-cover rounded"
          sizes="64px"
        />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-stone-800 truncate">
          {item.title}
        </p>
        <p className="text-xs text-stone-500 truncate">{item.body}</p>
        {item.distanceKm != null && (
          <p className="text-xs text-stone-400">{item.distanceKm} km</p>
        )}
      </div>
      <div className="flex items-center gap-3 shrink-0">
        <div className="flex items-center gap-1.5">
          <Checkbox
            id={`pub-poi-${item.id}`}
            checked={published}
            disabled={isPending}
            onCheckedChange={(checked) => {
              const next = checked === true;
              setPublished(next);
              startTransition(() => {
                void togglePoiPublishedAction(item.id, next);
              });
            }}
          />
          <Label htmlFor={`pub-poi-${item.id}`} className="text-xs">
            Gepubliceerd
          </Label>
        </div>
        <Button
          variant="ghost"
          size="sm"
          disabled={isPending}
          onClick={() => onEdit(item)}
        >
          Bewerken
        </Button>
        <Button
          variant="ghost"
          size="sm"
          disabled={isPending}
          onClick={() => {
            onDelete(item.id);
            startTransition(() => {
              void deletePoiAction(item.id);
            });
          }}
        >
          Verwijderen
        </Button>
      </div>
    </li>
  );
}

export function PoiClient({ pois }: { pois: Poi[] }) {
  const [serverPois, setServerPois] = useState(pois);
  const [items, setItems] = useState(pois);
  const [editing, setEditing] = useState<Poi | null>(null);

  if (serverPois !== pois) {
    setServerPois(pois);
    setItems(pois);
  }

  function handleDelete(id: string) {
    setItems((prev) => prev.filter((p) => p.id !== id));
    if (editing?.id === id) setEditing(null);
  }

  return (
    <div className="space-y-8">
      <PoiForm
        key={editing?.id ?? "new"}
        editing={editing}
        onCancel={() => setEditing(null)}
        onSaved={() => setEditing(null)}
      />

      {items.length === 0 ? (
        <p className="text-sm text-stone-500">
          Nog geen POI&apos;s aangemaakt.
        </p>
      ) : (
        <ul className="space-y-2">
          {items.map((item) => (
            <PoiRow
              key={item.id}
              item={item}
              onDelete={handleDelete}
              onEdit={setEditing}
            />
          ))}
        </ul>
      )}
    </div>
  );
}
