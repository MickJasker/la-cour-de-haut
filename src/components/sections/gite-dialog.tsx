"use client";

import { ComponentProps, useState } from "react";
import dynamic from "next/dynamic";
import { Button } from "@/components/ui/button";

// Lazy-load the Dialog (and its @radix-ui/react-dialog runtime) only once the
// user opens the gallery. `ssr: false` is valid here because this is a Client
// Component; the lightbox has no SSR value (it starts closed). Keeps the radix
// Dialog chunk out of the homepage's initial JS. See gite-gallery-dialog.tsx.
const GiteGalleryDialog = dynamic(() => import("./gite-gallery-dialog"), {
  ssr: false,
});

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
  // Once opened, keep the dialog mounted so radix can play its close animation
  // (unmounting on close would skip the exit transition).
  const [everOpened, setEverOpened] = useState(false);

  return (
    <>
      <Button
        variant="secondary"
        onClick={() => {
          setEverOpened(true);
          setOpen(true);
        }}
        {...props}
      >
        {children}
      </Button>
      {everOpened && (
        <GiteGalleryDialog
          images={images}
          open={open}
          onOpenChange={setOpen}
          title={children}
        />
      )}
    </>
  );
}
