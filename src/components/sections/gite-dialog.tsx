"use client";

import { ComponentProps, useState } from "react";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";

type GalleryImage = { id: string; imageUrl: string };

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
          <div className="grid grid-cols-2 gap-2 md:gap-3">
            {images.map((img) => (
              <div key={img.id} className="relative aspect-3/2">
                <Image
                  src={img.imageUrl}
                  alt=""
                  fill
                  className="object-cover rounded"
                  sizes="(max-width: 768px) 50vw, 33vw"
                />
              </div>
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
