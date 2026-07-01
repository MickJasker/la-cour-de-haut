"use client";

import type { ReactNode } from "react";
import Image from "next/image";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";

type GalleryImage = {
  id: string;
  imageUrl: string;
  width?: number | null;
  height?: number | null;
};

// The gallery lightbox pulls in @radix-ui/react-dialog (dismissable-layer,
// focus-scope, portal, presence). It is purely interaction-driven and below the
// fold, so `gite-dialog.tsx` lazy-loads this module via `next/dynamic` on first
// open — keeping the Dialog runtime off the homepage's initial JS. Default export
// so the dynamic import resolves without a `.then(m => m.X)` hop.
export default function GiteGalleryDialog({
  images,
  open,
  onOpenChange,
  title,
}: {
  images: GalleryImage[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: ReactNode;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-400" aria-describedby={undefined}>
        <DialogTitle className="sr-only">{title}</DialogTitle>
        {/* CSS multi-column (not grid) packs mixed portrait/landscape/square
            photos gap-free — grid would leave visible gaps under shorter
            cells in a mismatched row. break-inside-avoid keeps each photo
            from splitting across columns. */}
        <div className="columns-1 md:columns-2 gap-2 md:gap-3">
          {images.map((img) => {
            const hasDimensions =
              !!img.width && !!img.height && img.width > 0 && img.height > 0;

            return (
              <div key={img.id} className="mb-2 md:mb-3 break-inside-avoid">
                {hasDimensions ? (
                  <Image
                    src={img.imageUrl}
                    alt=""
                    width={img.width!}
                    height={img.height!}
                    className="w-full h-auto"
                    sizes="(max-width: 768px) 100vw, 50vw"
                  />
                ) : (
                  <div className="relative aspect-3/2">
                    <Image
                      src={img.imageUrl}
                      alt=""
                      fill
                      className="object-cover"
                      sizes="(max-width: 768px) 100vw, 50vw"
                    />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </DialogContent>
    </Dialog>
  );
}
