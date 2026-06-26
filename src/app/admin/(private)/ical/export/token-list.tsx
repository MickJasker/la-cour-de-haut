"use client";
import { useTransition, useState } from "react";
import { Button } from "@/components/ui/button";
import { deleteExportTokenAction } from "./actions";
import type { icalExportToken } from "@/db/schema";

type Token = typeof icalExportToken.$inferSelect;

function CopyButton({ value }: { value: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={() => {
        void navigator.clipboard.writeText(value).then(() => {
          setCopied(true);
          setTimeout(() => setCopied(false), 2000);
        });
      }}
    >
      {copied ? "Gekopieerd!" : "URL kopiëren"}
    </Button>
  );
}

function TokenRow({ token, appUrl }: { token: Token; appUrl: string }) {
  const [isPending, startTransition] = useTransition();
  const feedUrl = `${appUrl}/api/ical/${token.token}.ics`;

  return (
    <li className="rounded-md border border-stone-200 bg-cream-50 p-4 space-y-2">
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-1 min-w-0">
          <p className="font-medium text-sm">{token.name}</p>
          <p className="text-xs text-stone-500 font-mono truncate">{feedUrl}</p>
          {token.lastAccessedAt ? (
            <p className="text-xs text-stone-500">
              Laatste toegang: {token.lastAccessedAt.toLocaleString("nl-NL")}
            </p>
          ) : (
            <p className="text-xs text-stone-400">Nooit gebruikt</p>
          )}
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <CopyButton value={feedUrl} />
          <Button
            variant="ghost"
            size="sm"
            disabled={isPending}
            onClick={() => {
              if (
                !confirm(
                  `Token voor "${token.name}" intrekken? De feed-URL werkt dan niet meer.`,
                )
              )
                return;
              startTransition(() => {
                void deleteExportTokenAction(token.id);
              });
            }}
          >
            Intrekken
          </Button>
        </div>
      </div>
    </li>
  );
}

export function TokenList({
  tokens,
  appUrl,
}: {
  tokens: Token[];
  appUrl: string;
}) {
  if (tokens.length === 0) {
    return (
      <p className="text-sm text-stone-500">
        Nog geen exporttokens. Voeg er hieronder een toe om te beginnen.
      </p>
    );
  }
  return (
    <ul className="space-y-2">
      {tokens.map((t) => (
        <TokenRow key={t.id} token={t} appUrl={appUrl} />
      ))}
    </ul>
  );
}
