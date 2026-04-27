"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { Camera, ChevronLeft, ChevronRight, X } from "lucide-react";

interface JobImage {
  id: string;
  image_url: string;
  image_type: string;
  caption?: string;
  created_at: string;
}

interface ImageGalleryProps {
  jobId: string;
  imageType?: "job" | "progress" | "completion";
  label?: string;
  showEmpty?: boolean;
}

export function ImageGallery({
  jobId,
  imageType,
  label,
  showEmpty = false,
}: ImageGalleryProps) {
  const [images, setImages] = useState<JobImage[]>([]);
  const [lightbox, setLightbox] = useState<number | null>(null);
  const supabase = createClient();

  useEffect(() => {
    async function load() {
      let query = supabase
        .from("skc_job_images")
        .select("id, image_url, image_type, caption, created_at")
        .eq("job_id", jobId)
        .order("sort_order");

      if (imageType) query = query.eq("image_type", imageType);

      const { data } = await query;
      setImages(data ?? []);
    }
    load();
  }, [jobId, imageType]);

  if (images.length === 0 && !showEmpty) return null;

  const typeLabel =
    label ??
    (imageType === "job"
      ? "รูปเครื่อง/ลักษณะงาน"
      : imageType === "progress"
        ? "รูประหว่างทำงาน"
        : imageType === "completion"
          ? "รูปงานเสร็จ"
          : "รูปภาพ");

  return (
    <div className="space-y-2">
      <p className="text-xs font-medium text-muted-foreground flex items-center gap-1">
        <Camera className="size-3" />
        {typeLabel} ({images.length})
      </p>

      {images.length > 0 ? (
        <div className="grid grid-cols-2 gap-1.5">
          {images.map((img, i) => (
            <button
              key={img.id}
              type="button"
              onClick={() => setLightbox(i)}
              className="rounded-lg overflow-hidden border aspect-video bg-muted hover:ring-2 ring-blue-400 transition-all"
            >
              <img
                src={img.image_url}
                alt={img.caption || ""}
                className="size-full object-cover"
              />
            </button>
          ))}
        </div>
      ) : (
        <p className="text-xs text-muted-foreground text-center py-3">
          ยังไม่มีรูปภาพ
        </p>
      )}

      {/* Lightbox */}
      {lightbox !== null && (
        <div
          className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center"
          onClick={() => setLightbox(null)}
        >
          <button
            className="absolute top-4 right-4 text-white/80 hover:text-white"
            onClick={() => setLightbox(null)}
          >
            <X className="size-8" />
          </button>

          {lightbox > 0 && (
            <button
              className="absolute left-4 top-1/2 -translate-y-1/2 text-white/80 hover:text-white"
              onClick={(e) => {
                e.stopPropagation();
                setLightbox(lightbox - 1);
              }}
            >
              <ChevronLeft className="size-10" />
            </button>
          )}

          <img
            src={images[lightbox].image_url}
            alt=""
            className="max-h-[85vh] max-w-[90vw] object-contain rounded-lg"
            onClick={(e) => e.stopPropagation()}
          />

          {lightbox < images.length - 1 && (
            <button
              className="absolute right-4 top-1/2 -translate-y-1/2 text-white/80 hover:text-white"
              onClick={(e) => {
                e.stopPropagation();
                setLightbox(lightbox + 1);
              }}
            >
              <ChevronRight className="size-10" />
            </button>
          )}

          <div className="absolute bottom-4 text-white/60 text-sm">
            {lightbox + 1} / {images.length}
          </div>
        </div>
      )}
    </div>
  );
}
