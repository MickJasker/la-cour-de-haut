"use client";

import Image from "next/image";
import { useState } from "react";
import { cn } from "@/lib/utils";

export function ImageDropzone({
  file,
  onChange,
  existingUrl,
  required,
  testId,
}: {
  file: File | null;
  onChange: (f: File | null) => void;
  existingUrl?: string;
  required?: boolean;
  testId?: string;
}) {
  const [isDragOver, setIsDragOver] = useState(false);
  const preview = file ? URL.createObjectURL(file) : (existingUrl ?? null);

  return (
    <div className="space-y-2">
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setIsDragOver(true);
        }}
        onDragLeave={() => setIsDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setIsDragOver(false);
          const f = e.dataTransfer.files?.[0] ?? null;
          if (f && f.type.startsWith("image/")) onChange(f);
        }}
        className={cn(
          "relative border-2 border-dashed rounded-lg p-6 text-center transition-colors",
          isDragOver
            ? "border-primary bg-primary/5"
            : "border-stone-200 hover:border-stone-400",
        )}
      >
        <input
          data-testid={testId}
          type="file"
          accept="image/*"
          required={required}
          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
          onChange={(e) => onChange(e.target.files?.[0] ?? null)}
        />
        <p className="text-sm text-stone-500 pointer-events-none">
          Sleep een afbeelding hierheen, of{" "}
          <span className="text-primary underline">bladeren</span>
        </p>
        <p className="text-xs text-stone-400 mt-1 pointer-events-none">
          PNG, JPG, WebP
        </p>
      </div>

      {preview && (
        <div className="flex items-center gap-3">
          <div className="relative w-16 h-16 shrink-0">
            <Image
              src={preview}
              alt="Voorvertoning"
              fill
              className="object-cover rounded"
              sizes="64px"
              unoptimized={!!file}
            />
          </div>
          {file && (
            <div className="flex-1 min-w-0">
              <p className="text-sm text-stone-600 truncate">{file.name}</p>
              <button
                type="button"
                onClick={() => onChange(null)}
                className="text-xs text-stone-400 hover:text-stone-700"
              >
                Verwijderen
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
