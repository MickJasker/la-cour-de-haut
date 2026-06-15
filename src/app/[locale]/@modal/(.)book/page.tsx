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

export default function BookModal() {
  const router = useRouter();
  const t = useTranslations("sections.header");

  return (
    <Dialog open onOpenChange={(open) => !open && router.back()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("bookNow")}</DialogTitle>
        </DialogHeader>
        <BookForm />
      </DialogContent>
    </Dialog>
  );
}
