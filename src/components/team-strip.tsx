"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { UserAvatar } from "./user-avatar";
import { Users } from "lucide-react";
import { cn } from "@/lib/utils";

interface Worker {
  student_id: string;
  role: string;
  name?: string;
}

interface TeamStripProps {
  jobId: string;
  requiredWorkers: number;
  /** Compact mode for cards (smaller avatars, no labels) */
  compact?: boolean;
  /** Show role labels under each avatar */
  showLabels?: boolean;
}

/**
 * TeamStrip — shows the current team of students working on a job.
 * Renders filled avatars + empty slot placeholders up to required_workers.
 *
 * Example for a 5-person team with 2 currently approved:
 *   [👤 LEAD] [👤] [+] [+] [+]
 */
export function TeamStrip({
  jobId,
  requiredWorkers,
  compact = false,
  showLabels = false,
}: TeamStripProps) {
  const [workers, setWorkers] = useState<Worker[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      const supabase = createClient();
      const { data } = await supabase
        .from("skc_job_workers")
        .select("student_id, role, student:skc_users!skc_job_workers_student_id_fkey(name)")
        .eq("job_id", jobId)
        .order("role", { ascending: false }); // LEAD first
      if (cancelled) return;
      type Row = { student_id: string; role: string; student: { name: string } | { name: string }[] | null };
      const list: Worker[] = ((data ?? []) as Row[]).map((w) => {
        const student = Array.isArray(w.student) ? w.student[0] : w.student;
        return {
          student_id: w.student_id,
          role: w.role,
          name: student?.name,
        };
      });
      setWorkers(list);
    }
    load();
    return () => { cancelled = true; };
  }, [jobId]);

  if (!workers) {
    return <div className={cn("inline-flex gap-1", compact ? "h-6" : "h-8")} />;
  }

  const emptySlots = Math.max(0, requiredWorkers - workers.length);
  const size = compact ? "xs" : "sm";

  return (
    <div className="flex items-center gap-2 flex-wrap">
      <div className="flex items-center gap-1">
        {workers.map((w) => (
          <div key={w.student_id} className="flex flex-col items-center gap-0.5">
            <div className="relative">
              <UserAvatar userId={w.student_id} size={size} ring />
              {w.role === "LEAD" && (
                <span className="absolute -top-1 -right-1 size-3 rounded-full bg-amber-400 ring-1 ring-white" title="Team Lead" />
              )}
            </div>
            {showLabels && (
              <span className="text-[9px] text-muted-foreground max-w-[60px] truncate">
                {w.role === "LEAD" ? "👑 " : ""}{w.name?.split(" ")[0] ?? "—"}
              </span>
            )}
          </div>
        ))}
        {/* Empty slot placeholders */}
        {Array.from({ length: emptySlots }).map((_, i) => (
          <div key={`empty-${i}`} className="flex flex-col items-center gap-0.5">
            <div className={cn(
              "rounded-full border-2 border-dashed border-muted-foreground/30 flex items-center justify-center text-muted-foreground/40",
              compact ? "size-6 text-[10px]" : "size-8 text-xs",
            )}>
              +
            </div>
            {showLabels && <span className="text-[9px] text-muted-foreground/40">ว่าง</span>}
          </div>
        ))}
      </div>
      <span className="inline-flex items-center gap-1 text-[10px] text-muted-foreground">
        <Users className="size-3" />
        {workers.length}/{requiredWorkers}
      </span>
    </div>
  );
}
