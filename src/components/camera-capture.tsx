"use client";

import { useEffect, useRef, useState } from "react";
import { Camera, X, RotateCcw, Check, Loader2, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import { fetchAI, userHasAnyKey } from "@/lib/ai/user-keys";

/**
 * CameraCapture — fullscreen camera that takes 1+ photos directly from the
 * user's device camera, optionally runs AI photo-caption, and uploads to
 * Supabase storage.
 *
 * Designed to replace the traditional <input type="file"> flow for mobile.
 *
 * Props:
 *   open / onClose       — controls visibility
 *   jobId                — job to associate with
 *   imageType            — "job" | "progress" | "completion"
 *   maxImages            — total photos allowed
 *   phase                — passed to AI caption ("before" | "progress" | "after")
 *   onUploaded(urls)     — callback once images are saved to skc_job_images
 */

interface CameraCaptureProps {
  open: boolean;
  onClose: () => void;
  jobId: string;
  imageType: "job" | "progress" | "completion";
  maxImages?: number;
  jobTitle?: string;
  onUploaded?: (urls: string[]) => void;
}

interface CapturedShot {
  blob: Blob;
  dataUrl: string;
  caption?: string;
  detected?: string;
  quality?: number;
  concerns?: string;
  uploading?: boolean;
  uploaded?: boolean;
  aiAnalyzing?: boolean;
}

const PHASE_MAP: Record<string, "before" | "progress" | "after"> = {
  job: "before",
  progress: "progress",
  completion: "after",
};

export function CameraCapture({
  open,
  onClose,
  jobId,
  imageType,
  maxImages = 4,
  jobTitle,
  onUploaded,
}: CameraCaptureProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [shots, setShots] = useState<CapturedShot[]>([]);
  const [facing, setFacing] = useState<"environment" | "user">("environment");
  const [starting, setStarting] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const supabase = createClient();
  const hasAIKey = typeof window !== "undefined" && userHasAnyKey();

  // Start camera when modal opens
  useEffect(() => {
    if (!open) return;
    setStarting(true);
    let cancelled = false;

    async function start() {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: facing, width: { ideal: 1280 }, height: { ideal: 720 } },
          audio: false,
        });
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play().catch(() => {});
        }
      } catch (e) {
        toast.error("เปิดกล้องไม่สำเร็จ — กรุณาอนุญาตการใช้กล้องในเบราว์เซอร์");
        console.error(e);
      } finally {
        if (!cancelled) setStarting(false);
      }
    }
    start();

    return () => {
      cancelled = true;
      streamRef.current?.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    };
  }, [open, facing]);

  function flipCamera() {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    setFacing((f) => (f === "environment" ? "user" : "environment"));
  }

  // Capture from video → canvas → blob
  async function snap() {
    const v = videoRef.current;
    if (!v || !v.videoWidth) return;
    const canvas = document.createElement("canvas");
    canvas.width = v.videoWidth;
    canvas.height = v.videoHeight;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.drawImage(v, 0, 0);
    const blob = await new Promise<Blob | null>((res) =>
      canvas.toBlob((b) => res(b), "image/jpeg", 0.85),
    );
    if (!blob) return;

    const dataUrl = canvas.toDataURL("image/jpeg", 0.85);
    const shot: CapturedShot = { blob, dataUrl };
    setShots((s) => [...s, shot]);

    // Fire AI caption in background — don't block UI
    if (hasAIKey) {
      setShots((s) => s.map((x) => (x === shot ? { ...x, aiAnalyzing: true } : x)));
      try {
        const res = await fetchAI("/api/ai/photo-caption", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            image: dataUrl,
            phase: PHASE_MAP[imageType],
            job_title: jobTitle,
          }),
        });
        const data = await res.json();
        if (data.ok) {
          setShots((s) => s.map((x) =>
            x === shot
              ? {
                  ...x,
                  caption: data.caption,
                  detected: data.detected,
                  quality: data.quality,
                  concerns: data.concerns,
                  aiAnalyzing: false,
                }
              : x,
          ));
        } else {
          setShots((s) => s.map((x) => (x === shot ? { ...x, aiAnalyzing: false } : x)));
        }
      } catch {
        setShots((s) => s.map((x) => (x === shot ? { ...x, aiAnalyzing: false } : x)));
      }
    }
  }

  async function removeShot(i: number) {
    setShots((s) => s.filter((_, idx) => idx !== i));
  }

  async function updateCaption(i: number, caption: string) {
    setShots((s) => s.map((x, idx) => (idx === i ? { ...x, caption } : x)));
  }

  async function saveAll() {
    if (shots.length === 0) return;
    setSubmitting(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      toast.error("กรุณาเข้าสู่ระบบใหม่");
      setSubmitting(false);
      return;
    }

    const uploadedUrls: string[] = [];
    for (let i = 0; i < shots.length; i++) {
      const shot = shots[i];
      const fileName = `${jobId}/${imageType}/${crypto.randomUUID()}.jpg`;
      setShots((s) => s.map((x, idx) => (idx === i ? { ...x, uploading: true } : x)));
      const { error: upErr } = await supabase.storage
        .from("job-images")
        .upload(fileName, shot.blob, { contentType: "image/jpeg", upsert: false });
      if (upErr) {
        toast.error(`Upload รูปที่ ${i + 1} ไม่สำเร็จ: ${upErr.message}`);
        setShots((s) => s.map((x, idx) => (idx === i ? { ...x, uploading: false } : x)));
        continue;
      }
      const { data: urlData } = supabase.storage.from("job-images").getPublicUrl(fileName);
      const publicUrl = urlData.publicUrl;
      await supabase.from("skc_job_images").insert({
        job_id: jobId,
        image_url: publicUrl,
        image_type: imageType,
        caption: shot.caption || null,
        uploaded_by: user.id,
        sort_order: i,
      });
      uploadedUrls.push(publicUrl);
      setShots((s) => s.map((x, idx) => (idx === i ? { ...x, uploading: false, uploaded: true } : x)));
    }

    toast.success(`✅ บันทึก ${uploadedUrls.length} รูปสำเร็จ`);
    onUploaded?.(uploadedUrls);
    setShots([]);
    setSubmitting(false);
    onClose();
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black flex flex-col">
      {/* Top bar */}
      <div
        className="flex items-center justify-between p-3 text-white bg-black/60"
        style={{ paddingTop: "max(12px, env(safe-area-inset-top))" }}
      >
        <Button variant="ghost" size="sm" onClick={onClose} className="text-white hover:bg-white/10">
          <X className="size-5 mr-1" /> ปิด
        </Button>
        <div className="text-sm font-medium">
          {imageType === "job" ? "📷 รูปงาน (ก่อนเริ่ม)" :
           imageType === "progress" ? "🛠 ระหว่างทำงาน" :
           "✅ งานเสร็จ"}
          <span className="ml-2 text-xs text-white/60">
            {shots.length} / {maxImages}
          </span>
        </div>
        <Button variant="ghost" size="sm" onClick={flipCamera} className="text-white hover:bg-white/10">
          <RotateCcw className="size-5" />
        </Button>
      </div>

      {/* Camera viewport */}
      <div className="relative flex-1 bg-black overflow-hidden">
        {starting && (
          <div className="absolute inset-0 flex items-center justify-center text-white">
            <Loader2 className="size-8 animate-spin" />
          </div>
        )}
        <video
          ref={videoRef}
          playsInline
          muted
          className="w-full h-full object-cover"
        />
        {hasAIKey && (
          <div className="absolute top-3 left-3 right-3 flex items-center justify-center">
            <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/90 text-slate-900 px-3 py-1 text-xs font-medium">
              <Sparkles className="size-3" />
              AI จะสร้าง caption อัตโนมัติ
            </span>
          </div>
        )}
      </div>

      {/* Thumbnail strip */}
      {shots.length > 0 && (
        <div className="bg-black/80 p-3 flex gap-2 overflow-x-auto">
          {shots.map((shot, i) => (
            <div key={i} className="relative shrink-0">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={shot.dataUrl} alt="" className="size-16 rounded object-cover border border-white/20" />
              {shot.aiAnalyzing && (
                <div className="absolute inset-0 bg-black/60 rounded flex items-center justify-center">
                  <Sparkles className="size-4 text-amber-400 animate-pulse" />
                </div>
              )}
              {shot.uploaded && (
                <div className="absolute inset-0 bg-emerald-500/40 rounded flex items-center justify-center">
                  <Check className="size-6 text-white" />
                </div>
              )}
              <button
                onClick={() => removeShot(i)}
                className="absolute -top-1 -right-1 size-5 rounded-full bg-red-500 text-white flex items-center justify-center text-xs"
                aria-label="ลบรูป"
              >
                ×
              </button>
            </div>
          ))}
        </div>
      )}

      {/* AI caption preview (last shot) */}
      {shots.length > 0 && (() => {
        const last = shots[shots.length - 1];
        if (!last.caption) return null;
        return (
          <div className="bg-slate-900/95 text-white p-3 text-xs space-y-1 border-t border-white/10">
            <div className="flex items-center gap-1 text-amber-300">
              <Sparkles className="size-3" />
              <span className="font-medium">AI บอกว่า:</span>
            </div>
            <p className="text-white/90">{last.caption}</p>
            {last.detected && <p className="text-white/60">🔍 พบ: {last.detected}</p>}
            {last.concerns && (
              <p className="text-amber-300">⚠️ ระวัง: {last.concerns}</p>
            )}
          </div>
        );
      })()}

      {/* Bottom controls — extra bottom padding for iOS home indicator (safe-area inset) */}
      <div
        className="bg-black p-4 flex items-center justify-around gap-4"
        style={{ paddingBottom: "max(1rem, env(safe-area-inset-bottom))" }}
      >
        {/* Switch to gallery (fallback file picker) */}
        <label className="text-white/70 text-xs flex flex-col items-center gap-1 cursor-pointer">
          <input
            type="file"
            accept="image/*"
            className="hidden"
            multiple
            onChange={async (e) => {
              const files = Array.from(e.target.files ?? []);
              for (const f of files) {
                const dataUrl = await new Promise<string>((res) => {
                  const r = new FileReader();
                  r.onload = () => res(r.result as string);
                  r.readAsDataURL(f);
                });
                setShots((s) => [...s, { blob: f, dataUrl }]);
              }
              e.target.value = "";
            }}
          />
          <span className="size-10 rounded-full bg-white/10 flex items-center justify-center">📂</span>
          คลังภาพ
        </label>

        {/* Shutter */}
        <button
          onClick={snap}
          disabled={shots.length >= maxImages || starting}
          className={cn(
            "size-16 rounded-full bg-white ring-4 ring-white/30 active:scale-95 transition-transform",
            "disabled:opacity-50 disabled:cursor-not-allowed",
          )}
          aria-label="ถ่ายรูป"
        />

        {/* Save / done */}
        <Button
          onClick={saveAll}
          disabled={shots.length === 0 || submitting}
          className="flex flex-col items-center gap-1 h-auto py-2 bg-emerald-500 hover:bg-emerald-600 text-white"
        >
          {submitting ? (
            <Loader2 className="size-5 animate-spin" />
          ) : (
            <>
              <Check className="size-5" />
              <span className="text-xs">บันทึก</span>
            </>
          )}
        </Button>
      </div>
    </div>
  );
}
