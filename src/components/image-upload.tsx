"use client";

import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Camera, X, Loader2, ImagePlus } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";

interface ImageUploadProps {
  jobId: string;
  imageType: "job" | "progress" | "completion";
  maxImages?: number;
  existingImages?: { id: string; image_url: string; caption?: string }[];
  onUploadComplete?: (images: { id: string; image_url: string }[]) => void;
  disabled?: boolean;
  label?: string;
}

export function ImageUpload({
  jobId,
  imageType,
  maxImages = 4,
  existingImages = [],
  onUploadComplete,
  disabled = false,
  label,
}: ImageUploadProps) {
  const [uploading, setUploading] = useState(false);
  const [previews, setPreviews] = useState<{ file: File; preview: string }[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const supabase = createClient();

  const totalImages = existingImages.length + previews.length;
  const canAddMore = totalImages < maxImages;

  function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    const allowed = maxImages - totalImages;
    const selected = files.slice(0, allowed);

    const newPreviews = selected.map((file) => ({
      file,
      preview: URL.createObjectURL(file),
    }));
    setPreviews((prev) => [...prev, ...newPreviews]);

    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  function removePreview(index: number) {
    setPreviews((prev) => {
      URL.revokeObjectURL(prev[index].preview);
      return prev.filter((_, i) => i !== index);
    });
  }

  async function handleUpload() {
    if (previews.length === 0) return;
    setUploading(true);

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        toast.error("กรุณาเข้าสู่ระบบ");
        setUploading(false);
        return;
      }

      const uploaded: { id: string; image_url: string }[] = [];

      for (let i = 0; i < previews.length; i++) {
        const { file } = previews[i];
        const ext = file.name.split(".").pop() || "jpg";
        const path = `${jobId}/${imageType}/${crypto.randomUUID()}.${ext}`;

        // Upload to Supabase Storage
        const { error: uploadError } = await supabase.storage
          .from("job-images")
          .upload(path, file, { contentType: file.type, upsert: false });

        if (uploadError) {
          toast.error(`อัปโหลดไม่สำเร็จ: ${uploadError.message}`);
          continue;
        }

        // Get public URL
        const {
          data: { publicUrl },
        } = supabase.storage.from("job-images").getPublicUrl(path);

        // Insert record in DB
        const { data: record, error: dbError } = await supabase
          .from("skc_job_images")
          .insert({
            job_id: jobId,
            image_url: publicUrl,
            image_type: imageType,
            sort_order: existingImages.length + i,
            uploaded_by: user.id,
          })
          .select("id, image_url")
          .single();

        if (dbError) {
          toast.error(`บันทึกข้อมูลไม่สำเร็จ: ${dbError.message}`);
          continue;
        }

        if (record) uploaded.push(record);
      }

      // Clean up previews
      previews.forEach((p) => URL.revokeObjectURL(p.preview));
      setPreviews([]);

      if (uploaded.length > 0) {
        toast.success(`อัปโหลด ${uploaded.length} รูปสำเร็จ`);
        onUploadComplete?.(uploaded);
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "เกิดข้อผิดพลาด");
    } finally {
      setUploading(false);
    }
  }

  async function handleDeleteExisting(imageId: string) {
    const { error } = await supabase
      .from("skc_job_images")
      .delete()
      .eq("id", imageId);
    if (error) {
      toast.error("ลบไม่สำเร็จ");
    } else {
      toast.success("ลบรูปแล้ว");
      onUploadComplete?.(existingImages.filter((img) => img.id !== imageId));
    }
  }

  const typeLabel =
    label ??
    (imageType === "job"
      ? "รูปเครื่อง/ลักษณะงาน"
      : imageType === "progress"
        ? "รูประหว่างทำงาน"
        : "รูปงานเสร็จ");

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium text-foreground flex items-center gap-1.5">
          <Camera className="size-4" />
          {typeLabel} ({existingImages.length + previews.length}/{maxImages})
        </p>
      </div>

      {/* Existing + Preview Grid */}
      {(existingImages.length > 0 || previews.length > 0) && (
        <div className="grid grid-cols-2 gap-2">
          {existingImages.map((img) => (
            <div key={img.id} className="relative group rounded-lg overflow-hidden border aspect-video bg-muted">
              <img
                src={img.image_url}
                alt=""
                className="size-full object-cover"
              />
              {!disabled && (
                <button
                  type="button"
                  onClick={() => handleDeleteExisting(img.id)}
                  className="absolute top-1 right-1 rounded-full bg-black/60 p-1 text-white opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  <X className="size-3" />
                </button>
              )}
            </div>
          ))}
          {previews.map((p, i) => (
            <div key={i} className="relative group rounded-lg overflow-hidden border aspect-video bg-muted">
              <img src={p.preview} alt="" className="size-full object-cover" />
              <button
                type="button"
                onClick={() => removePreview(i)}
                className="absolute top-1 right-1 rounded-full bg-black/60 p-1 text-white opacity-0 group-hover:opacity-100 transition-opacity"
              >
                <X className="size-3" />
              </button>
              <div className="absolute bottom-0 inset-x-0 bg-yellow-500/80 text-center text-xs text-white py-0.5">
                รอการอัปโหลด
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Actions */}
      {!disabled && (
        <div className="flex gap-2">
          {canAddMore && (
            <>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                multiple
                className="hidden"
                onChange={handleFileSelect}
              />
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading}
              >
                <ImagePlus className="size-4 mr-1" />
                เลือกรูป
              </Button>
            </>
          )}
          {previews.length > 0 && (
            <Button
              type="button"
              size="sm"
              onClick={handleUpload}
              disabled={uploading}
            >
              {uploading ? (
                <>
                  <Loader2 className="size-4 mr-1 animate-spin" />
                  กำลังอัปโหลด...
                </>
              ) : (
                `อัปโหลด ${previews.length} รูป`
              )}
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
