"use client";

import { useRouter } from "next/navigation";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { useState } from "react";

/**
 * Client Dialog shell for the intercepted POI route. Lives in `layout.tsx` so
 * the Dialog stays mounted across the Suspense swap from `loading.tsx`'s
 * skeleton to `page.tsx`'s real content — the dialog opens once and its body
 * morphs in place (no re-animation flash). Starts open; closing (overlay/Esc/X)
 * plays the exit animation, then pops the intercepted URL via router.back()
 * once it finishes, mirroring the booking modal.
 *
 * The accessible `DialogTitle`/`DialogDescription` are supplied by the children
 * (page or loading fallback), not here, so the title can reflect the POI while
 * this shell fetches nothing and renders instantly.
 */
export function PoiModalShell({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [open, setOpen] = useState(true);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent
        className="max-w-2xl max-h-[90vh] overflow-y-auto"
        onAnimationEnd={(e) => {
          if (!open && e.target === e.currentTarget) router.back();
        }}
      >
        {children}
      </DialogContent>
    </Dialog>
  );
}
