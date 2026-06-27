"use client";

import {
  initialFormState,
  mergeForm,
  revalidateLogic,
  useForm,
  useTransform,
} from "@tanstack/react-form-nextjs";
import {
  useActionState,
  useState,
  startTransition,
  useEffect,
  useLayoutEffect,
  useRef,
  useTransition,
} from "react";
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
import { Field, FieldError, FieldGroup, FieldSet } from "@/components/ui/field";
import { cn } from "@/lib/utils";
import {
  createPoiAction,
  updatePoiAction,
  togglePoiPublishedAction,
  deletePoiAction,
  reorderPoisAction,
  type PoiActionState,
} from "./actions";
import { poiFormOpts, poiFormClientSchema } from "./shared";
import { TranslateDialog } from "@/components/translate-dialog";
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
  const [file, setFile] = useState<File | null>(null);

  const boundAction = editing
    ? updatePoiAction.bind(null, editing.id)
    : createPoiAction;

  const [state, formAction, isPending] = useActionState<
    PoiActionState,
    FormData
  >(boundAction, { ...initialFormState, success: false });

  const defaults = editing
    ? {
        title: editing.title,
        body: editing.body,
        distanceKm:
          editing.distanceKm != null ? String(editing.distanceKm) : "",
        published: editing.published,
      }
    : undefined;

  const form = useForm({
    ...poiFormOpts,
    ...(defaults ? { defaultValues: defaults } : {}),
    validators: { onDynamic: poiFormClientSchema },
    validationLogic: revalidateLogic({
      mode: "submit",
      modeAfterSubmission: "change",
    }),
    transform: useTransform(
      (baseForm) =>
        state.values !== undefined ? mergeForm(baseForm, state) : baseForm,
      [state],
    ),
    onSubmit: ({ value }) => {
      // Build FormData manually so we can attach the File object (drag-and-drop
      // sets file state, but the input has no name so native FormData misses it)
      const fd = new FormData();
      fd.set("title", JSON.stringify(value.title));
      fd.set("body", JSON.stringify(value.body));
      if (value.distanceKm) fd.set("distanceKm", value.distanceKm);
      fd.set("published", String(value.published));
      if (file) fd.set("file", file);
      startTransition(() => formAction(fd));
    },
  });

  const onSavedRef = useRef(onSaved);
  useLayoutEffect(() => {
    onSavedRef.current = onSaved;
  });

  useEffect(() => {
    if (state.success) onSavedRef.current();
  }, [state.success]);

  const inputCls =
    "w-full rounded border border-stone-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary";

  return (
    <form
      noValidate
      className="space-y-4 border border-stone-200 rounded-lg p-5 bg-stone-50"
      onSubmit={(e) => {
        e.preventDefault();
        void form.handleSubmit();
      }}
    >
      <h2 className="text-sm font-semibold text-stone-700">
        {editing ? "POI bewerken" : "Nieuwe POI toevoegen"}
      </h2>

      <FieldGroup>
        <FieldSet>
          <form.Field name="title.nl">
            {(field) => (
              <Field data-field="title">
                <Label htmlFor="poi-title">Titel</Label>
                <input
                  id="poi-title"
                  value={field.state.value}
                  onChange={(e) => field.handleChange(e.target.value)}
                  onBlur={field.handleBlur}
                  className={inputCls}
                />
                <FieldError errors={field.state.meta.errors} />
              </Field>
            )}
          </form.Field>
        </FieldSet>

        <FieldSet>
          <form.Field name="body.nl">
            {(field) => (
              <Field data-field="body">
                <Label htmlFor="poi-body">Beschrijving</Label>
                <textarea
                  id="poi-body"
                  value={field.state.value}
                  onChange={(e) => field.handleChange(e.target.value)}
                  onBlur={field.handleBlur}
                  rows={3}
                  className={inputCls}
                />
                <FieldError errors={field.state.meta.errors} />
              </Field>
            )}
          </form.Field>
        </FieldSet>

        <FieldSet>
          <form.Field name="distanceKm">
            {(field) => (
              <Field data-field="distanceKm">
                <Label htmlFor="poi-distance">Afstand (km)</Label>
                <input
                  id="poi-distance"
                  name={field.name}
                  type="number"
                  min={0}
                  value={field.state.value}
                  onChange={(e) => field.handleChange(e.target.value)}
                  onBlur={field.handleBlur}
                  className={inputCls}
                />
                <FieldError errors={field.state.meta.errors} />
              </Field>
            )}
          </form.Field>
        </FieldSet>

        <FieldSet>
          <form.Subscribe
            selector={(s) => ({ title: s.values.title, body: s.values.body })}
          >
            {({ title, body }) => (
              <TranslateDialog
                mode="poi"
                poiId={editing?.id}
                sourceTitleText={title.nl}
                sourceBodyText={body.nl}
                onTranslated={(t) => {
                  form.setFieldValue("title", {
                    ...form.getFieldValue("title"),
                    ...t.title,
                  });
                  form.setFieldValue("body", {
                    ...form.getFieldValue("body"),
                    ...t.body,
                  });
                }}
              />
            )}
          </form.Subscribe>
        </FieldSet>

        <FieldSet>
          <Label>
            Afbeelding{editing ? " (leeg laten om te behouden)" : ""}
          </Label>
          <ImageDropzone
            file={file}
            onChange={setFile}
            existingUrl={editing?.imageUrl}
            required={!editing && !file}
          />
          {typeof state.errorMap?.onServer === "string" && (
            <p className="text-destructive text-sm">
              {state.errorMap.onServer}
            </p>
          )}
        </FieldSet>

        <FieldSet>
          <form.Field name="published">
            {(field) => (
              <Field data-field="published">
                <input
                  type="hidden"
                  name={field.name}
                  value={String(field.state.value)}
                />
                <div className="flex items-center gap-2">
                  <Checkbox
                    id="poi-published"
                    checked={field.state.value}
                    onCheckedChange={(checked) =>
                      field.handleChange(checked === true)
                    }
                  />
                  <Label htmlFor="poi-published">Gepubliceerd</Label>
                </div>
                <FieldError errors={field.state.meta.errors} />
              </Field>
            )}
          </form.Field>
        </FieldSet>
      </FieldGroup>

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
          alt={item.title.nl}
          fill
          className="object-cover rounded"
          sizes="64px"
        />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-stone-800 truncate">
          {item.title.nl}
        </p>
        <p className="text-xs text-stone-500 truncate">{item.body.nl}</p>
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
  const [formKey, setFormKey] = useState(0);
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
        key={editing?.id ?? formKey}
        editing={editing}
        onCancel={() => setEditing(null)}
        onSaved={() => {
          setEditing(null);
          setFormKey((k) => k + 1);
        }}
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
