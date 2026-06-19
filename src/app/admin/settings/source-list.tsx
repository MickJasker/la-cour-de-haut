"use client";
import { useTransition, useState } from "react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { SourceForm } from "./source-form";
import { toggleSourceAction, deleteSourceAction } from "./actions";
import type { icalSource } from "@/db/schema";

type Source = typeof icalSource.$inferSelect;

function SyncHealth({ source }: { source: Source }) {
  if (source.lastError) {
    return (
      <div className="text-xs text-danger space-y-0.5">
        <p>
          Error: <span className="font-mono">{source.lastError}</span>
        </p>
        {source.lastErrorAt && (
          <p className="text-stone-400">
            {source.lastErrorAt.toLocaleString()}
          </p>
        )}
      </div>
    );
  }
  if (source.lastSyncedAt) {
    return (
      <p className="text-xs text-stone-500">
        Last synced: {source.lastSyncedAt.toLocaleString()}
      </p>
    );
  }
  return <p className="text-xs text-stone-400">Never synced</p>;
}

function SourceRow({ source }: { source: Source }) {
  const [isPending, startTransition] = useTransition();
  const [editing, setEditing] = useState(false);

  if (editing) {
    return (
      <li className="rounded-md border border-stone-200 p-4 space-y-4">
        <SourceForm
          mode="edit"
          sourceId={source.id}
          defaultValues={{
            name: source.name,
            url: source.url,
            enabled: source.enabled,
          }}
          onSuccess={() => setEditing(false)}
        />
        <Button variant="ghost" onClick={() => setEditing(false)}>
          Cancel
        </Button>
      </li>
    );
  }

  return (
    <li className="rounded-md border border-stone-200 bg-cream-50 p-4 space-y-2">
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-1 min-w-0">
          <p className="font-medium text-sm truncate">{source.name}</p>
          <p className="text-xs text-stone-500 font-mono truncate">
            {source.url}
          </p>
          <SyncHealth source={source} />
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <div className="flex items-center gap-1.5">
            <Checkbox
              id={`enabled-${source.id}`}
              checked={source.enabled}
              disabled={isPending}
              onCheckedChange={(checked) => {
                startTransition(() => {
                  void toggleSourceAction(source.id, checked === true);
                });
              }}
            />
            <Label htmlFor={`enabled-${source.id}`} className="text-xs">
              Enabled
            </Label>
          </div>

          <Button variant="ghost" size="sm" onClick={() => setEditing(true)}>
            Edit
          </Button>

          <Button
            variant="ghost"
            size="sm"
            disabled={isPending}
            onClick={() => {
              if (!confirm(`Delete "${source.name}"?`)) return;
              startTransition(() => {
                void deleteSourceAction(source.id);
              });
            }}
          >
            Delete
          </Button>
        </div>
      </div>
    </li>
  );
}

export function SourceList({ sources }: { sources: Source[] }) {
  if (sources.length === 0) {
    return (
      <p className="text-sm text-stone-500">No iCal sources configured yet.</p>
    );
  }

  return (
    <ul className="space-y-2">
      {sources.map((source) => (
        <SourceRow key={source.id} source={source} />
      ))}
    </ul>
  );
}
