"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Briefcase, Wrench, Zap, Wind, Car } from "lucide-react";
import { cn } from "@/lib/utils";

interface JobCardCoverProps {
  jobId: string;
  category?: string;
  className?: string;
}

const CATEGORY_FALLBACK: Record<string, { icon: typeof Briefcase; gradient: string }> = {
  electrical: { icon: Zap, gradient: "from-yellow-400 via-amber-400 to-orange-500" },
  hvac: { icon: Wind, gradient: "from-cyan-400 via-sky-400 to-blue-500" },
  automotive: { icon: Car, gradient: "from-red-500 via-rose-500 to-pink-500" },
  general: { icon: Wrench, gradient: "from-slate-500 via-slate-600 to-slate-700" },
};

/**
 * Photo cover for a job card. Loads the first available image from skc_job_images.
 * Falls back to a category-themed gradient with an icon when no images exist.
 *
 * Standard aspect ratio: 16:9 — works for both list + grid layouts.
 */
export function JobCardCover({ jobId, category = "general", className }: JobCardCoverProps) {
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      const supabase = createClient();
      // Prefer "completion" → "progress" → "job" — newest first
      const { data } = await supabase
        .from("skc_job_images")
        .select("image_url, image_type")
        .eq("job_id", jobId)
        .order("created_at", { ascending: false })
        .limit(1);
      if (cancelled) return;
      setImageUrl(data?.[0]?.image_url ?? null);
      setLoading(false);
    }
    load();
    return () => { cancelled = true; };
  }, [jobId]);

  const fallback = CATEGORY_FALLBACK[category] ?? CATEGORY_FALLBACK.general;
  const FallbackIcon = fallback.icon;

  if (loading) {
    return (
      <div className={cn("relative aspect-video w-full bg-muted animate-pulse rounded-t-lg", className)} />
    );
  }

  if (imageUrl) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={imageUrl}
        alt=""
        className={cn("aspect-video w-full object-cover rounded-t-lg", className)}
        loading="lazy"
      />
    );
  }

  // No image — show category-themed gradient
  return (
    <div
      className={cn(
        "relative aspect-video w-full rounded-t-lg flex items-center justify-center",
        "bg-gradient-to-br",
        fallback.gradient,
        className,
      )}
    >
      <FallbackIcon className="size-14 text-white/80" strokeWidth={1.5} />
      {/* subtle pattern overlay */}
      <div
        className="absolute inset-0 opacity-20 rounded-t-lg pointer-events-none"
        style={{
          backgroundImage: "radial-gradient(circle at 20% 30%, rgba(255,255,255,0.3) 0%, transparent 50%)",
        }}
      />
    </div>
  );
}

/**
 * Visual urgency badge — shows when deadline is close.
 *  < 24h → "ด่วน!" red
 *  < 72h → "ใกล้กำหนด" amber
 *  else → null
 */
export function DeadlineUrgency({ deadline }: { deadline: string }) {
  const now = Date.now();
  const due = new Date(deadline).getTime();
  const hours = (due - now) / (1000 * 60 * 60);

  if (hours < 0) {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-red-100 text-red-700 border border-red-200 px-2 py-0.5 text-[10px] font-semibold animate-pulse">
        ⚠️ เลยกำหนด
      </span>
    );
  }
  if (hours < 24) {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-red-100 text-red-700 border border-red-200 px-2 py-0.5 text-[10px] font-semibold animate-pulse">
        🔴 ด่วน {Math.ceil(hours)} ชม.
      </span>
    );
  }
  if (hours < 72) {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 text-amber-700 border border-amber-200 px-2 py-0.5 text-[10px] font-semibold">
        🟠 ใกล้กำหนด ({Math.ceil(hours / 24)} วัน)
      </span>
    );
  }
  return null;
}
