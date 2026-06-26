"use client";

import { useTransition, useRef, useState } from "react";
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
import {
  uploadGalleryImageAction,
  togglePublishedAction,
  deleteGalleryImageAction,
  reorderGalleryImagesAction,
} from "./actions";
import type { galleryImage } from "@/db/schema";

type GalleryImage = typeof galleryImage.$inferSelect;

function GalleryRow({
  image,
  onDelete,
}: {
  image: GalleryImage;
  onDelete: (id: string) => void;
}) {
  const [isPending, startTransition] = useTransition();
  const [published, setPublished] = useState(image.published);
  const { attributes, listeners, setNodeRef, transform, transition } =
    useSortable({ id: image.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <li
      ref={setNodeRef}
      style={style}
      data-testid={`gallery-row-${image.id}`}
      className="flex items-center gap-4 rounded-md border border-stone-200 bg-cream-50 p-3"
    >
      <button
        {...attributes}
        {...listeners}
        type="button"
        aria-label="Drag to reorder"
        className="cursor-grab text-stone-400 hover:text-stone-600 shrink-0"
      >
        ⠿
      </button>
      <div className="relative w-16 h-16 shrink-0">
        <Image
          src={image.imageUrl}
          alt=""
          fill
          className="object-cover rounded"
          sizes="64px"
        />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-xs text-stone-500 font-mono truncate">
          {image.imageUrl}
        </p>
      </div>
      <div className="flex items-center gap-3 shrink-0">
        <div className="flex items-center gap-1.5">
          <Checkbox
            id={`pub-${image.id}`}
            checked={published}
            disabled={isPending}
            onCheckedChange={(checked) => {
              const next = checked === true;
              setPublished(next);
              startTransition(() => {
                void togglePublishedAction(image.id, next);
              });
            }}
          />
          <Label htmlFor={`pub-${image.id}`} className="text-xs">
            Published
          </Label>
        </div>
        <Button
          variant="ghost"
          size="sm"
          disabled={isPending}
          onClick={() => {
            onDelete(image.id);
            startTransition(() => {
              void deleteGalleryImageAction(image.id);
            });
          }}
        >
          Delete
        </Button>
      </div>
    </li>
  );
}

export function GalleryList({ images }: { images: GalleryImage[] }) {
  const [items, setItems] = useState(images);
  const [, startTransition] = useTransition();

  function handleDelete(id: string) {
    setItems((prev) => prev.filter((img) => img.id !== id));
  }

  const sensors = useSensors(useSensor(PointerSensor));

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex = items.findIndex((img) => img.id === active.id);
    const newIndex = items.findIndex((img) => img.id === over.id);
    const reordered = arrayMove(items, oldIndex, newIndex);
    setItems(reordered);

    startTransition(() => {
      void reorderGalleryImagesAction(reordered.map((img) => img.id));
    });
  }

  if (items.length === 0) {
    return <p className="text-sm text-stone-500">No images uploaded yet.</p>;
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragEnd={handleDragEnd}
    >
      <SortableContext
        items={items.map((img) => img.id)}
        strategy={verticalListSortingStrategy}
      >
        <ul data-testid="gallery-list" className="space-y-2">
          {items.map((img) => (
            <GalleryRow key={img.id} image={img} onDelete={handleDelete} />
          ))}
        </ul>
      </SortableContext>
    </DndContext>
  );
}

export function UploadForm() {
  const [isPending, startTransition] = useTransition();
  const formRef = useRef<HTMLFormElement>(null);

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    startTransition(async () => {
      await uploadGalleryImageAction(formData);
      formRef.current?.reset();
    });
  }

  return (
    <form
      ref={formRef}
      onSubmit={handleSubmit}
      className="flex items-end gap-3"
    >
      <div className="space-y-1">
        <Label htmlFor="gallery-file" className="text-sm">
          Photo
        </Label>
        <input
          id="gallery-file"
          name="file"
          type="file"
          accept="image/*"
          required
          className="text-sm"
        />
      </div>
      <Button type="submit" disabled={isPending}>
        {isPending ? "Uploading…" : "Upload"}
      </Button>
    </form>
  );
}
