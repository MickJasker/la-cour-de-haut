"use client";

import { useTransition, useState } from "react";
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
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { LocaleStatus } from "@/components/locale-status";
import { uploadAdminImage } from "../upload-image";
import {
  uploadGalleryImageAction,
  togglePublishedAction,
  deleteGalleryImageAction,
  reorderGalleryImagesAction,
  saveAltTextAction,
  type SaveAltTextActionState,
} from "./actions";
import type { galleryImage, AltText, LocalizedSource } from "@/db/schema";

type GalleryImage = typeof galleryImage.$inferSelect;

function GalleryAltTextDialog({
  imageId,
  initialAltText,
  initialAltTextSource,
}: {
  imageId: string;
  initialAltText: AltText | null | undefined;
  initialAltTextSource: LocalizedSource | null | undefined;
}) {
  const [open, setOpen] = useState(false);
  const [nl, setNl] = useState(initialAltText?.nl ?? "");
  const [isPending, startTransition] = useTransition();
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveFailures, setSaveFailures] =
    useState<SaveAltTextActionState["failures"]>(undefined);

  // Reset nl to the latest server value when the dialog opens (avoids stale
  // state after a background RSC re-render updates initialAltText).
  const [prevOpen, setPrevOpen] = useState(open);
  if (prevOpen !== open) {
    setPrevOpen(open);
    if (open) {
      setNl(initialAltText?.nl ?? "");
      setSaveFailures(undefined);
    }
  }

  function handleSave() {
    setSaveError(null);
    startTransition(async () => {
      try {
        const result = await saveAltTextAction(imageId, nl);
        setSaveFailures(result.failures);
        // Keep the dialog open when translation failed so the owner can see
        // the warning below — otherwise it would close before being visible.
        if (!result.failures?.length) {
          setOpen(false);
        }
      } catch {
        setSaveError("Opslaan mislukt. Probeer het opnieuw.");
      }
    });
  }

  const sourceForStatus: LocalizedSource = initialAltTextSource ?? {
    nl: "human",
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="sm" type="button">
          Alt-tekst
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Alt-tekst bewerken</DialogTitle>
          <DialogDescription className="sr-only">
            Beschrijf de afbeelding voor schermlezers en zoekmachines.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <Label htmlFor={`alt-${imageId}`}>Alt-tekst (NL)</Label>
          <Input
            id={`alt-${imageId}`}
            value={nl}
            onChange={(e) => setNl(e.target.value)}
            placeholder="Beschrijf de afbeelding in het Nederlands"
          />
          <LocaleStatus source={sourceForStatus} />
          {saveError && <p className="text-sm text-destructive">{saveError}</p>}
          {saveFailures?.length ? (
            <p className="text-sm text-amber-700">
              Vertaling naar {saveFailures.join(", ")} is mislukt — opnieuw
              geprobeerd bij volgende opslag.
            </p>
          ) : null}
          <Button onClick={handleSave} disabled={isPending || nl.trim() === ""}>
            {isPending ? "Opslaan en vertalen…" : "Opslaan"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

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
      className="flex flex-wrap items-center gap-4 rounded-md border border-stone-200 bg-cream-50 p-3 sm:flex-nowrap"
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
      <div className="flex min-w-0 flex-wrap items-center gap-3 sm:shrink-0 sm:flex-nowrap">
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
            Gepubliceerd
          </Label>
        </div>
        <GalleryAltTextDialog
          imageId={image.id}
          initialAltText={image.altText}
          initialAltTextSource={image.altTextSource}
        />
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
          Verwijderen
        </Button>
      </div>
    </li>
  );
}

export function GalleryList({ images }: { images: GalleryImage[] }) {
  const [serverImages, setServerImages] = useState(images);
  const [items, setItems] = useState(images);
  const [, startTransition] = useTransition();

  // Sync with updated server props (e.g. after upload revalidates the page).
  // Updating state during render is React's recommended alternative to
  // useEffect+setState, which would cause an extra render cycle.
  if (serverImages !== images) {
    setServerImages(images);
    setItems(images);
  }

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
    return (
      <p className="text-sm text-stone-500">Nog geen afbeeldingen geüpload.</p>
    );
  }

  return (
    <DndContext
      id="gallery-sortable"
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

// Reads a File's real pixel dimensions in the browser, before it's uploaded.
// Client-side only — preserves the invariant that server actions never read
// file bytes (see upload-image.ts, #103). Never throws: any failure (decode
// error, or a zero/NaN width or height) resolves to null so the caller can
// fall back to storing no dimensions, which must never block the upload.
//
// NB: createImageBitmap applies EXIF orientation, so for a rotated photo these
// are the *displayed* (post-rotation) dimensions — whereas the backfill script
// (scripts/backfill-gallery-dimensions.mts, probe-image-size) reads *pre*-
// orientation dimensions. EXIF correction is explicitly out of scope for #103;
// a future EXIF issue should reconcile these two ingest paths.
async function readImageDimensions(
  file: File,
): Promise<{ width: number; height: number } | null> {
  let bitmap: ImageBitmap | undefined;
  try {
    bitmap = await createImageBitmap(file);
    const { width, height } = bitmap;
    if (!width || !height || Number.isNaN(width) || Number.isNaN(height)) {
      return null;
    }
    return { width, height };
  } catch {
    return null;
  } finally {
    bitmap?.close();
  }
}

export function UploadForm() {
  const [files, setFiles] = useState<File[]>([]);
  const [isDragOver, setIsDragOver] = useState(false);
  const [progress, setProgress] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function addFiles(list: FileList | null) {
    if (!list) return;
    const images = Array.from(list).filter(
      (f) =>
        f.type.startsWith("image/") ||
        /\.(jpe?g|png|webp|gif|avif)$/i.test(f.name),
    );
    setFiles((prev) => [...prev, ...images]);
  }

  function removeFile(index: number) {
    setFiles((prev) => prev.filter((_, i) => i !== index));
  }

  function handleUpload() {
    if (files.length === 0) return;
    const filesToUpload = [...files];
    // startTransition is required so Next.js sends back updated RSC after each
    // server action and re-renders GalleryList with the new images.
    startTransition(async () => {
      for (let i = 0; i < filesToUpload.length; i++) {
        setProgress(`Uploaden ${i + 1} / ${filesToUpload.length}…`);
        // The file streams straight from the browser to Vercel Blob; the
        // action only ever receives the resulting URL string. See #98.
        const file = filesToUpload[i]!;
        const dimensions = await readImageDimensions(file);
        const imageUrl = await uploadAdminImage(file, "gallery");
        await uploadGalleryImageAction(imageUrl, dimensions);
      }
      setFiles([]);
      setProgress(null);
    });
  }

  const isUploading = isPending;

  return (
    <div className="space-y-3">
      <div
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
          "relative border-2 border-dashed rounded-lg p-8 text-center transition-colors",
          isDragOver
            ? "border-primary bg-primary/5"
            : "border-stone-200 hover:border-stone-400",
          isUploading && "pointer-events-none opacity-60",
        )}
      >
        {/* Transparent overlay input — covers the zone so clicks open the picker */}
        <input
          data-testid="gallery-file-input"
          type="file"
          accept="image/*"
          multiple
          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
          onChange={(e) => addFiles(e.target.files)}
        />
        <p className="text-sm text-stone-500 pointer-events-none">
          Sleep afbeeldingen hierheen, of{" "}
          <span className="text-primary underline">bladeren</span>
        </p>
        <p className="text-xs text-stone-400 mt-1 pointer-events-none">
          PNG, JPG, WebP
        </p>
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
                aria-label={`${f.name} verwijderen`}
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
            : `${files.length} afbeelding${files.length !== 1 ? "en" : ""} uploaden`}
        </Button>
      )}
    </div>
  );
}
