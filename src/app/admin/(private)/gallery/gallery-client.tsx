"use client";

import { useTransition, useRef, useState } from "react";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import {
  uploadGalleryImageAction,
  togglePublishedAction,
  deleteGalleryImageAction,
} from "./actions";
import type { galleryImage } from "@/db/schema";

type GalleryImage = typeof galleryImage.$inferSelect;

function GalleryRow({ image }: { image: GalleryImage }) {
  const [isPending, startTransition] = useTransition();
  const [published, setPublished] = useState(image.published);

  return (
    <li
      data-testid={`gallery-row-${image.id}`}
      className="flex items-center gap-4 rounded-md border border-stone-200 bg-cream-50 p-3"
    >
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
        <p className="text-xs text-stone-400">Sort: {image.sortOrder}</p>
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
  if (images.length === 0) {
    return <p className="text-sm text-stone-500">No images uploaded yet.</p>;
  }
  return (
    <ul data-testid="gallery-list" className="space-y-2">
      {images.map((img) => (
        <GalleryRow key={img.id} image={img} />
      ))}
    </ul>
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
