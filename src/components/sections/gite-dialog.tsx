"use client";

import { ComponentProps, useState } from "react";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";

type GalleryImage = {
  id: string;
  imageUrl: string;
  width?: number | null;
  height?: number | null;
};

export function GiteDialog({
  images,
  children,
  ...props
}: {
  images: GalleryImage[];
} & ComponentProps<typeof Button>) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button variant="secondary" onClick={() => setOpen(true)} {...props}>
        {children}
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-400" aria-describedby={undefined}>
          <DialogTitle className="sr-only">{children}</DialogTitle>
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
                      sizes="(max-width: 768px) 50vw, 33vw"
                    />
                  ) : (
                    <div className="relative aspect-3/2">
                      <Image
                        src={img.imageUrl}
                        alt=""
                        fill
                        className="object-cover"
                        sizes="(max-width: 768px) 50vw, 33vw"
                      />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
