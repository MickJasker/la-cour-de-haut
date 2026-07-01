"use client";

import { useRouter } from "next/navigation";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useState } from "react";

/**
 * Client Dialog wrapper for the intercepted POI route. Starts open; closing
 * (overlay/Esc/X) plays the dialog's exit animation, then pops the
 * intercepted URL via router.back() once it finishes, mirroring the booking
 * modal. The server-rendered detail is passed as `children` so this client
 * boundary doesn't need to fetch or render server components itself.
 */
export function PoiModalClient({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
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
        <DialogHeader>
          <DialogTitle className="sr-only">{title}</DialogTitle>
          <DialogDescription className="sr-only">{title}</DialogDescription>
        </DialogHeader>
        {children}
      </DialogContent>
    </Dialog>
  );
}
