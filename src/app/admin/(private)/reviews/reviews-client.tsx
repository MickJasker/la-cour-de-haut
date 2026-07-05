"use client";

import { useState, useTransition } from "react";
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
  deleteReviewAction,
  toggleReviewPublishedAction,
  reorderReviewsAction,
} from "./actions";
import type { review } from "@/db/schema";
import Link from "next/link";

type Review = typeof review.$inferSelect;

const SOURCE_LABELS: Record<string, string> = {
  airbnb: "AirBnB",
  natuurhuisje: "Natuurhuisje",
  google: "Google",
  direct: "direct",
};

function ReviewRow({
  r,
  onDelete,
}: {
  r: Review;
  onDelete: (id: string) => void;
}) {
  const [isPending, startTransition] = useTransition();
  const [published, setPublished] = useState(r.published);
  const { attributes, listeners, setNodeRef, transform, transition } =
    useSortable({ id: r.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <li
      ref={setNodeRef}
      style={style}
      data-testid={`review-row-${r.id}`}
      className="flex items-center gap-4 rounded-md border border-stone-200 bg-cream-50 p-3"
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
      <div className="flex-1 min-w-0 flex flex-col gap-2 sm:grid sm:grid-cols-[1fr_auto_auto_auto] sm:gap-x-4 sm:items-center">
        <div className="min-w-0">
          <p className="font-medium text-sm truncate">{r.authorName}</p>
          <p className="text-xs text-stone-500 truncate">
            {"★".repeat(r.rating)}
            {"☆".repeat(5 - r.rating)} · {r.reviewDate} ·{" "}
            {SOURCE_LABELS[r.source] ?? r.source}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2 sm:contents">
          <div className="flex items-center gap-1.5 shrink-0">
            <Checkbox
              id={`pub-${r.id}`}
              checked={published}
              disabled={isPending}
              onCheckedChange={(checked) => {
                const next = checked === true;
                setPublished(next);
                startTransition(() => {
                  void toggleReviewPublishedAction(r.id, next);
                });
              }}
            />
            <Label htmlFor={`pub-${r.id}`} className="text-xs">
              Gepubliceerd
            </Label>
          </div>
          <Button variant="secondary" size="sm" asChild>
            <Link href={`/admin/reviews/${r.id}/edit`}>Bewerken</Link>
          </Button>
          <Button
            variant="ghost"
            size="sm"
            disabled={isPending}
            onClick={() => {
              onDelete(r.id);
              startTransition(() => {
                void deleteReviewAction(r.id);
              });
            }}
          >
            Verwijderen
          </Button>
        </div>
      </div>
    </li>
  );
}

export function ReviewsList({ reviews }: { reviews: Review[] }) {
  const [items, setItems] = useState(reviews);
  const [, startTransition] = useTransition();

  function handleDelete(id: string) {
    setItems((prev) => prev.filter((r) => r.id !== id));
  }

  const sensors = useSensors(useSensor(PointerSensor));

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex = items.findIndex((r) => r.id === active.id);
    const newIndex = items.findIndex((r) => r.id === over.id);
    const reordered = arrayMove(items, oldIndex, newIndex);
    setItems(reordered);

    startTransition(() => {
      void reorderReviewsAction(reordered.map((r) => r.id));
    });
  }

  if (items.length === 0) {
    return <p className="text-sm text-stone-500">Nog geen beoordelingen.</p>;
  }

  return (
    <DndContext
      id="reviews-sortable"
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragEnd={handleDragEnd}
    >
      <SortableContext
        items={items.map((r) => r.id)}
        strategy={verticalListSortingStrategy}
      >
        <ul className="space-y-2">
          {items.map((r) => (
            <ReviewRow key={r.id} r={r} onDelete={handleDelete} />
          ))}
        </ul>
      </SortableContext>
    </DndContext>
  );
}
