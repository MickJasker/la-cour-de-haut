"use client";

import { ComponentProps, useState } from "react";
import type { SerializedEditorState } from "lexical";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { RichTextRenderer } from "../rich-text-renderer";

export function GeneralInfoDialog({
  title,
  state,
  children,
  ...props
}: {
  /** Already-localized dialog title, resolved server-side (matches the
   * button label) — see gite.tsx. */
  title: string;
  /** Already-localized rich text (ADR-0017 "basic prose"), resolved
   * server-side via pickLocalized, same as GiteSection's `description`. */
  state: SerializedEditorState;
} & ComponentProps<typeof Button>) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button variant="secondary" onClick={() => setOpen(true)} {...props}>
        {children}
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-2xl" aria-describedby={undefined}>
          <DialogTitle className="text-style-display-medium mb-4">
            {title}
          </DialogTitle>
          <div className="overflow-y-auto max-h-[80vh]">
            <RichTextRenderer state={state} className="text-style-body-large" />
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
