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
import { ImageDropzone } from "../image-dropzone";
import { uploadAdminImage } from "../upload-image";
import {
  createPoiAction,
  updatePoiAction,
  togglePoiPublishedAction,
  deletePoiAction,
  reorderPoisAction,
  type PoiActionState,
} from "./actions";
import { poiFormOpts, poiFormClientSchema } from "./shared";
import { LocaleStatus } from "@/components/locale-status";
import { RichTextEditor } from "@/components/rich-text-editor";
import { EMPTY_EDITOR_STATE } from "@/lib/content/lexical/empty-state";
import type { poi, LocalizedEditorState } from "@/db/schema";

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
  const [file, setFile] = useState<File | null>(null);
  // Tracks the direct-to-Blob upload (browser -> Vercel Blob), which happens
  // before the action is dispatched, so the submit button stays disabled and
  // labelled for the whole save, not just the action round-trip. See #98.
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

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

  // The rich detail is opaque EditorState JSON, kept out of the TanStack form
  // value type (which would recurse into the node tree). It is attached to
  // FormData manually on submit, like the dropzone File. See ADR-0015.
  const [detail, setDetail] = useState<LocalizedEditorState>(
    editing?.detail ?? { nl: EMPTY_EDITOR_STATE },
  );

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
    onSubmit: async ({ value }) => {
      // Build FormData manually so we can attach the uploaded image URL
      // (drag-and-drop sets file state, but the input has no name so native
      // FormData misses it). The file itself goes straight to Vercel Blob
      // from the browser before the action runs — the action only ever sees
      // the resulting URL string, never the bytes. See #98.
      const fd = new FormData();
      fd.set("title", JSON.stringify(value.title));
      fd.set("body", JSON.stringify(value.body));
      fd.set("detail", JSON.stringify(detail));
      if (value.distanceKm) fd.set("distanceKm", value.distanceKm);
      fd.set("published", String(value.published));
      if (file) {
        setIsUploading(true);
        setUploadError(null);
        try {
          const imageUrl = await uploadAdminImage(file, "pois");
          fd.set("imageUrl", imageUrl);
          // React Compiler can't lower a try/catch/finally together (only
          // try/catch), so "stop uploading" is duplicated at the end of both
          // the try and catch bodies instead of a shared finally.
          setIsUploading(false);
        } catch (error) {
          setUploadError(
            error instanceof Error
              ? error.message
              : "Afbeelding uploaden mislukt",
          );
          setIsUploading(false);
          return;
        }
      }
      startTransition(() => formAction(fd));
    },
  });

  const onSavedRef = useRef(onSaved);
  useLayoutEffect(() => {
    onSavedRef.current = onSaved;
  });

  useEffect(() => {
    // Skip the reset/exit-edit-mode when translation partially failed, so the
    // warning below stays visible instead of unmounting with the form.
    if (state.success && !state.failures?.length) onSavedRef.current();
  }, [state.success, state.failures]);

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
      <LocaleStatus
        source={editing?.titleSource ?? { nl: "human" as const }}
        className="mt-0.5"
      />

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
          <Field data-field="detail">
            <Label>Detailtekst (rijke tekst)</Label>
            <RichTextEditor
              initialValue={detail.nl}
              onChange={(nl) => setDetail((d) => ({ ...d, nl }))}
              ariaLabel="Detailtekst"
            />
          </Field>
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
          <Label>
            Afbeelding{editing ? " (leeg laten om te behouden)" : ""}
          </Label>
          <ImageDropzone
            file={file}
            onChange={setFile}
            existingUrl={editing?.imageUrl}
            required={!editing && !file}
            testId="poi-file-input"
          />
          {typeof state.errorMap?.onServer === "string" && (
            <p className="text-destructive text-sm">
              {state.errorMap.onServer}
            </p>
          )}
          {uploadError && (
            <p className="text-destructive text-sm">{uploadError}</p>
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

      {state.failures?.length ? (
        <p className="text-sm text-amber-700">
          Vertaling naar {state.failures.join(", ")} is mislukt — opnieuw
          geprobeerd bij volgende opslag.
        </p>
      ) : null}

      <div className="flex gap-2">
        <Button type="submit" disabled={isPending || isUploading}>
          {isUploading
            ? "Afbeelding uploaden…"
            : isPending
              ? "Opslaan en vertalen…"
              : "Opslaan"}
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
          id="pois-sortable"
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
