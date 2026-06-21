"use client";

import { useState } from "react";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";

type GalleryImage = { id: string; imageUrl: string };

export function GiteDialog({
  buttonLabel,
  images,
}: {
  buttonLabel: string;
  images: GalleryImage[];
}) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button variant="secondary" onClick={() => setOpen(true)}>
        {buttonLabel}
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-4xl">
          <DialogTitle className="sr-only">{buttonLabel}</DialogTitle>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
            {images.map((img) => (
              <div key={img.id} className="relative aspect-square">
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
