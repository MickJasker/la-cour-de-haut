"use client";

import { useRouter } from "next/navigation";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { BookForm } from "@/components/sections/book-form";
import { useTranslations } from "next-intl";
import { Suspense } from "react";
import { LoaderCircle } from "lucide-react";

export function BookModalClient({
  bookedDates,
}: {
  bookedDates: Promise<string[]>;
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
        </DialogHeader>
        <Suspense
          fallback={
            <div className="h-96 grid place-content-center">
              <LoaderCircle className="animate-spin size-30 stroke-1 text-accent-foreground" />
            </div>
          }
        >
          <BookForm bookedDates={bookedDates} />
        </Suspense>
      </DialogContent>
    </Dialog>
  );
}
