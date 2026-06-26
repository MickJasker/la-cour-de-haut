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
import { cn } from "@/lib/utils";
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
  const [files, setFiles] = useState<File[]>([]);
  const [isDragOver, setIsDragOver] = useState(false);
  const [progress, setProgress] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  function addFiles(list: FileList | null) {
    if (!list) return;
    const images = Array.from(list).filter((f) => f.type.startsWith("image/"));
    setFiles((prev) => [...prev, ...images]);
  }

  function removeFile(index: number) {
    setFiles((prev) => prev.filter((_, i) => i !== index));
  }

  async function handleUpload() {
    if (files.length === 0) return;
    for (let i = 0; i < files.length; i++) {
      setProgress(`Uploading ${i + 1} / ${files.length}…`);
      const formData = new FormData();
      formData.append("file", files[i]!);
      await uploadGalleryImageAction(formData);
    }
    setFiles([]);
    setProgress(null);
  }

  const isUploading = progress !== null;

  return (
    <div className="space-y-3">
      <div
        role="button"
        tabIndex={0}
        onClick={() => !isUploading && inputRef.current?.click()}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") inputRef.current?.click();
        }}
        onDragOver={(e) => {
          e.preventDefault();
          setIsDragOver(true);
        }}
        onDragLeave={() => setIsDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setIsDragOver(false);
          addFiles(e.dataTransfer.files);
        }}
        className={cn(
          "border-2 border-dashed rounded-lg p-8 text-center cursor-pointer select-none transition-colors",
          isDragOver
            ? "border-primary bg-primary/5"
            : "border-stone-200 hover:border-stone-400",
          isUploading && "pointer-events-none opacity-60",
        )}
      >
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          multiple
          className="hidden"
          onChange={(e) => addFiles(e.target.files)}
        />
        <p className="text-sm text-stone-500">
          Drag &amp; drop images here, or{" "}
          <span className="text-primary underline">browse</span>
        </p>
        <p className="text-xs text-stone-400 mt-1">PNG, JPG, WebP</p>
      </div>

      {files.length > 0 && (
        <ul className="space-y-1">
          {files.map((f, i) => (
            <li
              key={i}
              className="flex items-center justify-between text-sm text-stone-600 bg-stone-50 rounded px-3 py-1.5"
            >
              <span className="truncate">{f.name}</span>
              <button
                type="button"
                onClick={() => removeFile(i)}
                className="ml-3 text-stone-400 hover:text-stone-700 shrink-0"
                aria-label={`Remove ${f.name}`}
              >
                ✕
              </button>
            </li>
          ))}
        </ul>
      )}

      {(files.length > 0 || isUploading) && (
        <Button onClick={handleUpload} disabled={isUploading}>
          {isUploading
            ? progress
            : `Upload ${files.length} image${files.length !== 1 ? "s" : ""}`}
        </Button>
      )}
    </div>
  );
}
