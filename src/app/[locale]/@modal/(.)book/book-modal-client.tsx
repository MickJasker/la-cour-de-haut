"use client";

import { useRouter } from "next/navigation";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { BookForm } from "@/components/sections/book-form";
import { useTranslations } from "@/i18n/provider";
import { Suspense } from "react";
import { LoaderCircle } from "lucide-react";

export function BookModalClient({
  bookedDates,
  pricePerNight,
}: {
  bookedDates: Promise<string[]>;
  pricePerNight: Promise<number>;
}) {
  const router = useRouter();
  const t = useTranslations("sections.header");

  return (
    <Dialog open onOpenChange={(open) => !open && router.back()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="text-style-eyebrow-medium text-center">
            {t("bookNow")}
          </DialogTitle>
          <DialogDescription className="sr-only">
            {t("bookDescription")}
          </DialogDescription>
        </DialogHeader>
        <Suspense
          fallback={
            <div className="h-96 grid place-content-center">
              <LoaderCircle className="animate-spin size-30 stroke-1 text-accent-foreground" />
            </div>
          }
        >
          <BookForm bookedDates={bookedDates} pricePerNight={pricePerNight} />
        </Suspense>
      </DialogContent>
    </Dialog>
  );
}
