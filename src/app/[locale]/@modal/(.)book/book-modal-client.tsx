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
import { BookFormSkeleton } from "@/components/sections/book-form-skeleton";
import { useTranslations } from "@/i18n/provider";
import { Suspense, useState } from "react";
import type { BookingPaymentConfig } from "../../book/shared";

export function BookModalClient({
  bookedDates,
  pricePerNight,
  paymentConfig,
}: {
  bookedDates: Promise<string[]>;
  pricePerNight: Promise<number>;
  paymentConfig: Promise<BookingPaymentConfig>;
}) {
  const router = useRouter();
  const t = useTranslations("sections.header");
  const [open, setOpen] = useState(true);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent
        onAnimationEnd={(e) => {
          if (!open && e.target === e.currentTarget) router.back();
        }}
      >
        <DialogHeader>
          <DialogTitle className="text-style-eyebrow-medium text-center">
            {t("bookNow")}
          </DialogTitle>
          <DialogDescription className="sr-only">
            {t("bookDescription")}
          </DialogDescription>
        </DialogHeader>
        <Suspense fallback={<BookFormSkeleton />}>
          <BookForm
            bookedDates={bookedDates}
            pricePerNight={pricePerNight}
            paymentConfig={paymentConfig}
            stickyCta
          />
        </Suspense>
      </DialogContent>
    </Dialog>
  );
}
