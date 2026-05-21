"use client";

import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { MapPin, ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { JobCardCover, DeadlineUrgency } from "@/components/job-card-cover";
import { TeamStrip } from "@/components/team-strip";

/**
 * HeroJobCard — large featured card used in two contexts:
 *
 *   1. /student/jobs (logged-in นศ.)
 *      Pass `onApply` handler → button = "ส่งคำขอรับงาน" / "⏳ ส่งแล้ว"
 *
 *   2. / (public landing)
 *      Omit `onApply` → renders as <Link href="/jobs/[id]"> with
 *      "ดูรายละเอียด →" — viewer is prompted to login on the detail page
 *
 * Layout is the same in both contexts (snap-scroll on mobile,
 * 3-col tablet, 5-col desktop) so the parent grid controls cols.
 */

const TYPE_LABELS: Record<string, string> = {
  PAID: "งานจ้าง",
  VOLUNTEER: "จิตอาสา",
  TRAINING: "ฝึกทักษะ",
  EXEMPTED: "ยกเว้นค่าบริการ",
};

const CATEGORY_LABELS: Record<string, string> = {
  electrical: "ไฟฟ้า",
  hvac: "แอร์/เครื่องเย็น",
  automotive: "ยานยนต์",
  general: "ทั่วไป",
};

const BADGE_COLORS: Record<string, string> = {
  PAID: "bg-green-100 text-green-800",
  VOLUNTEER: "bg-blue-100 text-blue-800",
  TRAINING: "bg-yellow-100 text-yellow-800",
  EXEMPTED: "bg-purple-100 text-purple-800",
};

const CATEGORY_COLORS: Record<string, string> = {
  electrical: "bg-amber-100 text-amber-800",
  hvac: "bg-cyan-100 text-cyan-800",
  automotive: "bg-red-100 text-red-800",
  general: "bg-gray-100 text-gray-800",
};

export interface HeroJobCardJob {
  id: string;
  title: string;
  type: string;
  job_category: string;
  location?: string | null;
  pay_amount?: number | null;
  deadline?: string | null;
  required_workers?: number | null;
}

export function HeroJobCard({
  job,
  pending,
  onApply,
}: {
  job: HeroJobCardJob;
  pending?: boolean;
  onApply?: (id: string) => void;
}) {
  const pay = Number(job.pay_amount ?? 0);
  const isPublic = !onApply;

  const cardInner = (
    <Card
      className="
        overflow-hidden hover:ring-2 hover:ring-sky-300 transition-all p-0 group
        snap-start shrink-0
        w-[80%] sm:w-auto
      "
    >
      {/* Cover image — tall enough to be striking */}
      <div className="relative">
        <JobCardCover
          jobId={job.id}
          category={job.job_category}
          className="!max-h-32 sm:!max-h-28 lg:!max-h-32 !aspect-[4/3] sm:!aspect-[5/3] object-cover"
        />
        {/* Floating pay badge — top-right */}
        {pay > 0 && (
          <div className="absolute top-2 right-2 rounded-full bg-emerald-500 text-white px-2.5 py-1 text-[11px] font-bold shadow-lg backdrop-blur">
            💰 {pay.toLocaleString()} TRPB
          </div>
        )}
        {/* Urgency pill — top-left */}
        {job.deadline && (
          <div className="absolute top-2 left-2">
            <DeadlineUrgency deadline={job.deadline} />
          </div>
        )}
      </div>

      <CardContent className="p-3 space-y-2">
        <h3 className="font-semibold text-foreground line-clamp-2 leading-snug min-h-[2.5rem]">
          {job.title}
        </h3>

        <div className="flex flex-wrap gap-1">
          <span className={cn("inline-flex rounded-full px-1.5 py-0.5 text-[10px] font-medium", BADGE_COLORS[job.type] ?? "")}>
            {TYPE_LABELS[job.type] ?? job.type}
          </span>
          <span className={cn("inline-flex rounded-full px-1.5 py-0.5 text-[10px] font-medium", CATEGORY_COLORS[job.job_category] ?? "")}>
            {CATEGORY_LABELS[job.job_category] ?? job.job_category}
          </span>
        </div>

        {job.location && (
          <div className="flex items-center gap-1 text-[11px] text-muted-foreground truncate">
            <MapPin className="size-3 shrink-0" />
            <span className="truncate">{job.location}</span>
          </div>
        )}

        {/* Team progress strip — only if multi-worker */}
        {job.required_workers && job.required_workers > 1 && (
          <TeamStrip jobId={job.id} requiredWorkers={job.required_workers} compact />
        )}

        {/* CTA */}
        {isPublic ? (
          <Button size="sm" className="w-full h-7 text-[11px] bg-sky-600 hover:bg-sky-700">
            ดูรายละเอียด <ArrowRight className="size-3 ml-1" />
          </Button>
        ) : pending ? (
          <Button size="sm" variant="secondary" disabled className="w-full opacity-70 text-[11px] h-7">
            ⏳ ส่งคำขอแล้ว
          </Button>
        ) : (
          <Button
            size="sm"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              onApply?.(job.id);
            }}
            className="w-full h-7 text-[11px] bg-sky-600 hover:bg-sky-700"
          >
            ส่งคำขอรับงาน →
          </Button>
        )}
      </CardContent>
    </Card>
  );

  // Public viewer → wrap entire card in a link to public detail
  if (isPublic) {
    return (
      <Link href={`/jobs/${job.id}`} className="block">
        {cardInner}
      </Link>
    );
  }
  return cardInner;
}
