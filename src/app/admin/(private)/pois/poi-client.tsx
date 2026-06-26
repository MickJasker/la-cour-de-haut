"use client";

import { useTransition, useState, useId } from "react";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import {
  createPoiAction,
  togglePoiPublishedAction,
  deletePoiAction,
} from "./actions";
import type { poi } from "@/db/schema";

type Poi = typeof poi.$inferSelect;

function PoiRow({
  item,
  onDelete,
}: {
  item: Poi;
  onDelete: (id: string) => void;
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

function PoiList({ pois }: { pois: Poi[] }) {
  const [serverPois, setServerPois] = useState(pois);
  const [items, setItems] = useState(pois);

  if (serverPois !== pois) {
    setServerPois(pois);
    setItems(pois);
  }

  function handleDelete(id: string) {
    setItems((prev) => prev.filter((p) => p.id !== id));
  }

  if (items.length === 0) {
    return (
      <p className="text-sm text-stone-500">Nog geen POI&apos;s aangemaakt.</p>
    );
  }

  return (
    <ul className="space-y-2">
      {items.map((item) => (
        <PoiRow key={item.id} item={item} onDelete={handleDelete} />
      ))}
    </ul>
  );
}

function CreatePoiForm() {
  const [isPending, startTransition] = useTransition();
  const [file, setFile] = useState<File | null>(null);
  const titleId = useId();
  const bodyId = useId();
  const distanceId = useId();
  const sortOrderId = useId();

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const data = new FormData(form);
    if (file) data.set("file", file);

    startTransition(async () => {
      await createPoiAction(data);
      form.reset();
      setFile(null);
    });
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="space-y-4 border border-stone-200 rounded-lg p-5 bg-stone-50"
    >
      <h2 className="text-sm font-semibold text-stone-700">
        Nieuwe POI toevoegen
      </h2>

      <div className="space-y-1">
        <Label htmlFor={titleId}>Titel</Label>
        <input
          id={titleId}
          name="title"
          required
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
            className="w-full rounded border border-stone-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor={sortOrderId}>Volgorde</Label>
          <input
            id={sortOrderId}
            name="sortOrder"
            type="number"
            defaultValue={0}
            className="w-full rounded border border-stone-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
          />
        </div>
      </div>

      <div className="space-y-1">
        <Label>Afbeelding</Label>
        <input
          data-testid="poi-file-input"
          type="file"
          accept="image/*"
          required
          onChange={(e) => setFile(e.target.files?.[0] ?? null)}
          className="block text-sm text-stone-600"
        />
      </div>

      <Button type="submit" disabled={isPending}>
        {isPending ? "Opslaan…" : "Opslaan"}
      </Button>
    </form>
  );
}

export function PoiClient({ pois }: { pois: Poi[] }) {
  return (
    <div className="space-y-8">
      <CreatePoiForm />
      <PoiList pois={pois} />
    </div>
  );
}
