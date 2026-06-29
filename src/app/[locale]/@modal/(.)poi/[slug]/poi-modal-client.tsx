"use client";

import { useRouter } from "next/navigation";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useTranslations } from "@/i18n/provider";

/**
 * Client Dialog wrapper for the intercepted POI route. Forced open; closing
 * (overlay/Esc/X) pops the intercepted URL via router.back(), mirroring the
 * booking modal. The server-rendered detail is passed as `children` so this
 * client boundary doesn't need to fetch or render server components itself.
 */
export function PoiModalClient({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const t = useTranslations("sections.poi");

  return (
    <Dialog open onOpenChange={(open) => !open && router.back()}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="sr-only">{t("title")}</DialogTitle>
          <DialogDescription className="sr-only">
            {t("title")}
          </DialogDescription>
        </DialogHeader>
        {children}
      </DialogContent>
    </Dialog>
  );
}
