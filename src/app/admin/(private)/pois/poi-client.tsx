"use client";

import { useTransition, useState, useId } from "react";
import Image from "next/image";
import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  verticalListSortingStrategy,
  useSortable,
  arrayMove,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import {
  createPoiAction,
  updatePoiAction,
  togglePoiPublishedAction,
  deletePoiAction,
  reorderPoisAction,
} from "./actions";
import type { poi } from "@/db/schema";

type Poi = typeof poi.$inferSelect;

function ImageDropzone({
  file,
  onChange,
  existingUrl,
  required,
}: {
  file: File | null;
  onChange: (f: File | null) => void;
  existingUrl?: string;
  required?: boolean;
}) {
  const [isDragOver, setIsDragOver] = useState(false);
  const preview = file ? URL.createObjectURL(file) : (existingUrl ?? null);

  return (
    <div className="space-y-2">
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setIsDragOver(true);
        }}
        onDragLeave={() => setIsDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setIsDragOver(false);
          const f = e.dataTransfer.files?.[0] ?? null;
          if (f && f.type.startsWith("image/")) onChange(f);
        }}
        className={cn(
          "relative border-2 border-dashed rounded-lg p-6 text-center transition-colors",
          isDragOver
            ? "border-primary bg-primary/5"
            : "border-stone-200 hover:border-stone-400",
        )}
      >
        <input
          data-testid="poi-file-input"
          type="file"
          accept="image/*"
          required={required}
          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
          onChange={(e) => onChange(e.target.files?.[0] ?? null)}
        />
        <p className="text-sm text-stone-500 pointer-events-none">
          Sleep een afbeelding hierheen, of{" "}
          <span className="text-primary underline">bladeren</span>
        </p>
        <p className="text-xs text-stone-400 mt-1 pointer-events-none">
          PNG, JPG, WebP
        </p>
      </div>

      {preview && (
        <div className="flex items-center gap-3">
          <div className="relative w-16 h-16 shrink-0">
            <Image
              src={preview}
              alt="Voorvertoning"
              fill
              className="object-cover rounded"
              sizes="64px"
              unoptimized={!!file}
            />
          </div>
          {file && (
            <div className="flex-1 min-w-0">
              <p className="text-sm text-stone-600 truncate">{file.name}</p>
              <button
                type="button"
                onClick={() => onChange(null)}
                className="text-xs text-stone-400 hover:text-stone-700"
              >
                Verwijderen
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

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
        <Label>Afbeelding{editing ? " (leeg laten om te behouden)" : ""}</Label>
        <ImageDropzone
          file={file}
          onChange={setFile}
          existingUrl={editing?.imageUrl}
          required={!editing && !file}
        />
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
  const { attributes, listeners, setNodeRef, transform, transition } =
    useSortable({ id: item.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <li
      ref={setNodeRef}
      style={style}
      data-testid={`poi-row-${item.id}`}
      className="flex items-center gap-4 rounded-md border border-stone-200 bg-white p-3"
    >
      <button
        {...attributes}
        {...listeners}
        type="button"
        aria-label="Slepen om te herordenen"
        className="cursor-grab text-stone-400 hover:text-stone-600 shrink-0"
      >
        ⠿
      </button>
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
  const [, startTransition] = useTransition();

  if (serverPois !== pois) {
    setServerPois(pois);
    setItems(pois);
  }

  function handleDelete(id: string) {
    setItems((prev) => prev.filter((p) => p.id !== id));
    if (editing?.id === id) setEditing(null);
  }

  const sensors = useSensors(useSensor(PointerSensor));

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex = items.findIndex((p) => p.id === active.id);
    const newIndex = items.findIndex((p) => p.id === over.id);
    const reordered = arrayMove(items, oldIndex, newIndex);
    setItems(reordered);

    startTransition(() => {
      void reorderPoisAction(reordered.map((p) => p.id));
    });
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
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={handleDragEnd}
        >
          <SortableContext
            items={items.map((p) => p.id)}
            strategy={verticalListSortingStrategy}
          >
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
          </SortableContext>
        </DndContext>
      )}
    </div>
  );
}
