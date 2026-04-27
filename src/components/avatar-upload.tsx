"use client";

import { useState, useRef } from "react";
import { createClient } from "@/lib/supabase/client";
import { Camera, Loader2 } from "lucide-react";
import { toast } from "sonner";

interface AvatarUploadProps {
  userId: string;
  currentUrl: string | null;
  name: string;
  size?: "sm" | "md" | "lg";
  editable?: boolean;
  onUploaded?: (url: string) => void;
}

const SIZE_MAP = {
  sm: "size-10 text-sm",
  md: "size-16 text-lg",
  lg: "size-24 text-2xl",
};

export function AvatarUpload({
  userId,
  currentUrl,
  name,
  size = "md",
  editable = false,
  onUploaded,
}: AvatarUploadProps) {
  const [uploading, setUploading] = useState(false);
  const [avatarUrl, setAvatarUrl] = useState(currentUrl);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const supabase = createClient();

  async function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 2 * 1024 * 1024) {
      toast.error("รูปต้องไม่เกิน 2MB");
      return;
    }

    if (!file.type.startsWith("image/")) {
      toast.error("กรุณาเลือกไฟล์รูปภาพ");
      return;
    }

    setUploading(true);
    try {
      const ext = file.name.split(".").pop() || "jpg";
      const path = `avatars/${userId}.${ext}`;

      // Upload (upsert to replace old avatar)
      const { error: uploadError } = await supabase.storage
        .from("job-images")
        .upload(path, file, { contentType: file.type, upsert: true });

      if (uploadError) {
        toast.error(`อัปโหลดไม่สำเร็จ: ${uploadError.message}`);
        setUploading(false);
        return;
      }

      const {
        data: { publicUrl },
      } = supabase.storage.from("job-images").getPublicUrl(path);

      // Add cache-busting param
      const url = `${publicUrl}?t=${Date.now()}`;

      // Update user record
      const { error: dbError } = await supabase
        .from("skc_users")
        .update({ avatar_url: url })
        .eq("id", userId);

      if (dbError) {
        toast.error(`บันทึกไม่สำเร็จ: ${dbError.message}`);
      } else {
        setAvatarUrl(url);
        toast.success("อัปโหลดรูปโปรไฟล์สำเร็จ");
        onUploaded?.(url);
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "เกิดข้อผิดพลาด");
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  const initials = name ? name.charAt(0).toUpperCase() : "?";
  const sizeClass = SIZE_MAP[size];

  return (
    <div className="relative inline-block">
      {avatarUrl ? (
        <img
          src={avatarUrl}
          alt={name}
          className={`${sizeClass} rounded-full object-cover border-2 border-white shadow`}
        />
      ) : (
        <div
          className={`${sizeClass} flex items-center justify-center rounded-full bg-blue-100 text-blue-700 font-bold border-2 border-white shadow`}
        >
          {initials}
        </div>
      )}

      {editable && (
        <>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handleFileSelect}
          />
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
            className="absolute -bottom-1 -right-1 rounded-full bg-blue-600 p-1.5 text-white shadow hover:bg-blue-700 transition-colors disabled:opacity-50"
          >
            {uploading ? (
              <Loader2 className="size-3 animate-spin" />
            ) : (
              <Camera className="size-3" />
            )}
          </button>
        </>
      )}
    </div>
  );
}

// Simple display-only avatar (no upload)
export function UserAvatar({
  url,
  name,
  size = "sm",
}: {
  url: string | null;
  name: string;
  size?: "sm" | "md" | "lg";
}) {
  const initials = name ? name.charAt(0).toUpperCase() : "?";
  const sizeClass = SIZE_MAP[size];

  if (url) {
    return (
      <img
        src={url}
        alt={name}
        className={`${sizeClass} rounded-full object-cover`}
      />
    );
  }

  return (
    <div
      className={`${sizeClass} flex items-center justify-center rounded-full bg-blue-100 text-blue-700 font-bold`}
    >
      {initials}
    </div>
  );
}
