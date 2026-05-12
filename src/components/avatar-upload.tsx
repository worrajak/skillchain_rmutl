"use client";

import { useState, useRef } from "react";
import { createClient } from "@/lib/supabase/client";
import { Camera, Loader2, Trash2, Upload } from "lucide-react";
import { toast } from "sonner";
import { UserAvatar as UserAvatarBase } from "./user-avatar";
import { Button } from "@/components/ui/button";

/**
 * AvatarUpload — user uploads/replaces their profile picture.
 *
 * Storage:
 *   - Bucket: avatars (public, 2 MB max, jpeg/png/webp)
 *   - Path:   <user_id>/avatar.jpg
 *   - DB:     skc_users.avatar_url (with cache-bust query param)
 *
 * Auto-compresses to ≤ 512px on the longest side before upload.
 */

const MAX_SIDE = 512;

async function compressToJpeg(file: File): Promise<Blob> {
  const dataUrl = await new Promise<string>((res, rej) => {
    const r = new FileReader();
    r.onload = () => res(r.result as string);
    r.onerror = rej;
    r.readAsDataURL(file);
  });
  const img = await new Promise<HTMLImageElement>((res, rej) => {
    const i = new Image();
    i.onload = () => res(i);
    i.onerror = rej;
    i.src = dataUrl;
  });
  const ratio = Math.min(1, MAX_SIDE / Math.max(img.width, img.height));
  const w = Math.round(img.width * ratio);
  const h = Math.round(img.height * ratio);
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d")!;
  ctx.drawImage(img, 0, 0, w, h);
  return new Promise<Blob>((res, rej) =>
    canvas.toBlob(
      (b) => (b ? res(b) : rej(new Error("compress failed"))),
      "image/jpeg",
      0.88,
    ),
  );
}

interface AvatarUploadProps {
  userId: string;
  currentUrl: string | null;
  name: string;
  role?: string | null;
  size?: "sm" | "md" | "lg" | "xl";
  editable?: boolean;
  onUploaded?: (url: string | null) => void;
}

export function AvatarUpload({
  userId,
  currentUrl,
  name,
  role,
  size = "lg",
  editable = true,
  onUploaded,
}: AvatarUploadProps) {
  const cameraRef = useRef<HTMLInputElement>(null);
  const galleryRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [avatarUrl, setAvatarUrl] = useState(currentUrl);

  async function handleFile(file: File) {
    if (!file.type.startsWith("image/")) {
      toast.error("กรุณาเลือกไฟล์รูปภาพ");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast.error("ไฟล์ใหญ่เกินไป (เกิน 5 MB)");
      return;
    }

    setUploading(true);
    try {
      const blob = await compressToJpeg(file);
      const supabase = createClient();
      const path = `${userId}/avatar.jpg`;

      const { error: upErr } = await supabase.storage
        .from("avatars")
        .upload(path, blob, {
          contentType: "image/jpeg",
          upsert: true,
          cacheControl: "0",
        });
      if (upErr) throw upErr;

      const { data: urlData } = supabase.storage.from("avatars").getPublicUrl(path);
      const url = `${urlData.publicUrl}?v=${Date.now()}`;

      const { error: dbErr } = await supabase
        .from("skc_users")
        .update({ avatar_url: url })
        .eq("id", userId);
      if (dbErr) throw dbErr;

      setAvatarUrl(url);
      toast.success("✅ อัพเดตรูปโปรไฟล์แล้ว");
      onUploaded?.(url);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Upload ไม่สำเร็จ");
    } finally {
      setUploading(false);
    }
  }

  async function remove() {
    if (!confirm("ลบรูปโปรไฟล์?")) return;
    setUploading(true);
    try {
      const supabase = createClient();
      await supabase.storage.from("avatars").remove([`${userId}/avatar.jpg`]);
      await supabase.from("skc_users").update({ avatar_url: null }).eq("id", userId);
      setAvatarUrl(null);
      onUploaded?.(null);
      toast.success("ลบรูปแล้ว");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "ลบไม่สำเร็จ");
    } finally {
      setUploading(false);
    }
  }

  // Map old size names to UserAvatar size
  const sizeMap: Record<string, "sm" | "md" | "lg" | "xl"> = {
    sm: "sm",
    md: "md",
    lg: "lg",
    xl: "xl",
  };

  return (
    <div className="flex flex-col items-center gap-3">
      <div className="relative">
        <UserAvatarBase
          user={{ name, avatar_url: avatarUrl, role }}
          size={sizeMap[size]}
          ring
        />
        {uploading && (
          <div className="absolute inset-0 rounded-full bg-black/60 flex items-center justify-center">
            <Loader2 className="size-6 text-white animate-spin" />
          </div>
        )}
      </div>

      {editable && (
        <>
          <input
            ref={cameraRef}
            type="file"
            accept="image/*"
            capture="user"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) handleFile(f);
              e.target.value = "";
            }}
          />
          <input
            ref={galleryRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) handleFile(f);
              e.target.value = "";
            }}
          />

          <div className="flex gap-2 flex-wrap justify-center">
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => cameraRef.current?.click()}
              disabled={uploading}
            >
              <Camera className="size-4 mr-1" />
              ถ่ายรูป
            </Button>
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => galleryRef.current?.click()}
              disabled={uploading}
            >
              <Upload className="size-4 mr-1" />
              เลือกรูป
            </Button>
            {avatarUrl && (
              <Button
                type="button"
                size="sm"
                variant="ghost"
                onClick={remove}
                disabled={uploading}
                className="text-red-600 hover:text-red-700"
              >
                <Trash2 className="size-4 mr-1" />
                ลบ
              </Button>
            )}
          </div>

          <p className="text-[11px] text-muted-foreground text-center">
            ไม่เกิน 2 MB · บีบอัดอัตโนมัติเป็น 512px
          </p>
        </>
      )}
    </div>
  );
}

// Backward-compat shim for older callers that use `url + name + size`.
// New code should import UserAvatar from "@/components/user-avatar" directly.
export function UserAvatar({
  url,
  name,
  size = "sm",
}: {
  url: string | null;
  name: string;
  size?: "sm" | "md" | "lg";
}) {
  return <UserAvatarBase user={{ name, avatar_url: url }} size={size} />;
}
