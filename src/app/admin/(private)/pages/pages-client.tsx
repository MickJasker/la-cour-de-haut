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
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Field, FieldError, FieldGroup, FieldSet } from "@/components/ui/field";
import {
  createPageAction,
  updatePageAction,
  togglePagePublishedAction,
  deletePageAction,
  type PageActionState,
} from "./actions";
import { pageFormOpts, pageFormClientSchema } from "./shared";
import { LocaleStatus } from "@/components/locale-status";
import { RichTextEditor } from "@/components/rich-text-editor";
import {
  EMPTY_EDITOR_STATE,
  hasEditorText,
} from "@/lib/content/lexical/empty-state";
import type { page as pageTable, LocalizedEditorState } from "@/db/schema";

type Page = typeof pageTable.$inferSelect;

function PageForm({
  editing,
  onCancel,
  onSaved,
}: {
  editing: Page | null;
  onCancel: () => void;
  onSaved: () => void;
}) {
  const boundAction = editing
    ? updatePageAction.bind(null, editing.id)
    : createPageAction;

  const [state, formAction, isPending] = useActionState<
    PageActionState,
    FormData
  >(boundAction, { ...initialFormState, success: false });

  const defaults = editing ? { title: editing.title } : undefined;

  // The rich body is opaque EditorState JSON, kept out of the TanStack form
  // value type (which would recurse into the node tree). It is attached to
  // FormData manually on submit, mirroring POI detail (ADR-0015).
  const [body, setBody] = useState<LocalizedEditorState>(
    editing?.body ?? { nl: EMPTY_EDITOR_STATE },
  );
  const bodyIsEmpty = !hasEditorText(body.nl);

  const form = useForm({
    ...pageFormOpts,
    ...(defaults ? { defaultValues: defaults } : {}),
    validators: { onDynamic: pageFormClientSchema },
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
      const fd = new FormData();
      fd.set("title", JSON.stringify(value.title));
      fd.set("body", JSON.stringify(body));
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
        {editing ? "Pagina bewerken" : "Nieuwe pagina toevoegen"}
      </h2>
      <LocaleStatus
        source={editing?.titleSource ?? { nl: "human" as const }}
        className="mt-0.5"
      />

      {editing && (
        <p className="text-xs text-stone-500">
          Slug: <span className="font-mono">{editing.slug}</span> (kan niet
          worden gewijzigd)
        </p>
      )}

      <FieldGroup>
        <FieldSet>
          <form.Field name="title.nl">
            {(field) => (
              <Field data-field="title">
                <Label htmlFor="page-title">Titel</Label>
                <input
                  id="page-title"
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
          <Field data-field="body">
            <Label>Inhoud (rijke tekst)</Label>
            <RichTextEditor
              initialValue={body.nl}
              onChange={(nl) => setBody((b) => ({ ...b, nl }))}
              ariaLabel="Inhoud"
              variant="full"
            />
          </Field>
        </FieldSet>

        {typeof state.errorMap?.onServer === "string" && (
          <p className="text-destructive text-sm">{state.errorMap.onServer}</p>
        )}
      </FieldGroup>

      {state.failures?.length ? (
        <p className="text-sm text-amber-700">
          Vertaling naar {state.failures.join(", ")} is mislukt — opnieuw
          geprobeerd bij volgende opslag.
        </p>
      ) : null}

      <div className="flex gap-2">
        <Button type="submit" disabled={isPending || bodyIsEmpty}>
          {isPending ? "Opslaan en vertalen…" : "Opslaan"}
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

function PageRow({
  item,
  appUrl,
  onDelete,
  onEdit,
}: {
  item: Page;
  appUrl: string;
  onDelete: (id: string) => void;
  onEdit: (item: Page) => void;
}) {
  const [isPending, startTransition] = useTransition();
  const [published, setPublished] = useState(item.published);
  const publicUrl = `${appUrl}/nl/${item.slug}`;

  function handleDelete() {
    if (!confirm(`Pagina "${item.title.nl}" verwijderen?`)) return;
    onDelete(item.id);
    startTransition(() => {
      void deletePageAction(item.id);
    });
  }

  return (
    <li
      data-testid={`page-row-${item.id}`}
      className="flex flex-wrap items-center gap-4 rounded-md border border-stone-200 bg-white p-3 md:flex-nowrap"
    >
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold text-stone-800 truncate">
          {item.title.nl}
        </p>
        <p className="truncate font-mono text-xs text-stone-500">{publicUrl}</p>
      </div>
      <div className="flex min-w-0 flex-wrap items-center gap-3 md:shrink-0 md:flex-nowrap">
        {item.system ? (
          <span className="rounded bg-stone-200 px-2 py-0.5 text-xs font-medium text-stone-700">
            Systeempagina
          </span>
        ) : (
          <div className="flex items-center gap-1.5">
            <Checkbox
              id={`pub-page-${item.id}`}
              checked={published}
              disabled={isPending}
              onCheckedChange={(checked) => {
                const next = checked === true;
                setPublished(next);
                startTransition(() => {
                  void togglePagePublishedAction(item.id, next);
                });
              }}
            />
            <Label htmlFor={`pub-page-${item.id}`} className="text-xs">
              Gepubliceerd
            </Label>
          </div>
        )}
        <Button
          variant="ghost"
          size="sm"
          disabled={isPending}
          onClick={() => onEdit(item)}
        >
          Bewerken
        </Button>
        {!item.system && (
          <Button
            variant="ghost"
            size="sm"
            disabled={isPending}
            onClick={handleDelete}
          >
            Verwijderen
          </Button>
        )}
      </div>
    </li>
  );
}

export function PagesClient({
  pages,
  appUrl,
}: {
  pages: Page[];
  appUrl: string;
}) {
  const [serverPages, setServerPages] = useState(pages);
  const [items, setItems] = useState(pages);
  const [editing, setEditing] = useState<Page | null>(null);
  const [formKey, setFormKey] = useState(0);

  // Sync with updated server props (e.g. after an action revalidates the
  // page). Updating state during render is React's recommended alternative
  // to useEffect+setState — same pattern as PoiClient/GalleryList.
  if (serverPages !== pages) {
    setServerPages(pages);
    setItems(pages);
  }

  function handleDelete(id: string) {
    setItems((prev) => prev.filter((p) => p.id !== id));
    if (editing?.id === id) setEditing(null);
  }

  return (
    <div className="space-y-8">
      <PageForm
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
          Nog geen pagina&apos;s aangemaakt.
        </p>
      ) : (
        <ul data-testid="page-list" className="space-y-2">
          {items.map((item) => (
            <PageRow
              key={item.id}
              item={item}
              appUrl={appUrl}
              onDelete={handleDelete}
              onEdit={setEditing}
            />
          ))}
        </ul>
      )}
    </div>
  );
}
