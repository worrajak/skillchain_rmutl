"use client";

import { cn } from "@/lib/utils";
import type { CredentialLevel } from "@/types/database";
import {
  UserCheck,
  Shield,
  GraduationCap,
  Award,
  Crown,
} from "lucide-react";

const config: Record<
  CredentialLevel,
  {
    num: number;
    en: string;
    th: string;
    icon: typeof Award;
    color: string;
    bg: string;
    ring: string;
    gradient: string;
  }
> = {
  LEVEL_1: {
    num: 1,
    en: "Registered",
    th: "ลงทะเบียน",
    icon: UserCheck,
    color: "text-gray-600",
    bg: "bg-gray-100",
    ring: "ring-gray-300",
    gradient: "from-gray-400 to-gray-500",
  },
  LEVEL_2: {
    num: 2,
    en: "Project Certified",
    th: "ผ่านฝึกอบรมโครงการ",
    icon: Shield,
    color: "text-amber-700",
    bg: "bg-amber-50",
    ring: "ring-amber-300",
    gradient: "from-amber-500 to-orange-600",
  },
  LEVEL_3: {
    num: 3,
    en: "Teacher Certified",
    th: "อาจารย์รับรอง",
    icon: GraduationCap,
    color: "text-blue-700",
    bg: "bg-blue-50",
    ring: "ring-blue-300",
    gradient: "from-blue-500 to-indigo-600",
  },
  LEVEL_4: {
    num: 4,
    en: "National Certified",
    th: "สถาบันระดับชาติรับรอง",
    icon: Award,
    color: "text-yellow-700",
    bg: "bg-yellow-50",
    ring: "ring-yellow-400",
    gradient: "from-yellow-400 to-amber-500",
  },
  LEVEL_5: {
    num: 5,
    en: "Master Technician",
    th: "ช่างชำนาญการ",
    icon: Crown,
    color: "text-purple-700",
    bg: "bg-purple-50",
    ring: "ring-purple-400",
    gradient: "from-purple-500 to-fuchsia-600",
  },
};

// Compact badge
export function CredentialBadge({
  level,
  size = "md",
  showLabel = true,
}: {
  level: CredentialLevel;
  size?: "sm" | "md" | "lg";
  showLabel?: boolean;
}) {
  const c = config[level];
  const Icon = c.icon;

  const sizeClasses = {
    sm: "px-2 py-0.5 text-xs gap-1",
    md: "px-2.5 py-1 text-sm gap-1.5",
    lg: "px-3 py-1.5 text-base gap-2",
  };

  const iconSize = { sm: "size-3", md: "size-4", lg: "size-5" };

  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full font-medium ring-1",
        c.bg,
        c.color,
        c.ring,
        sizeClasses[size]
      )}
    >
      <Icon className={iconSize[size]} />
      {showLabel && (
        <>
          Lv.{c.num}
          <span className="hidden sm:inline">— {c.th}</span>
        </>
      )}
    </span>
  );
}

// Full credential card
export function CredentialCard({
  level,
  specialization,
  certifiedBy,
  issuedAt,
  expiresAt,
  certificateRef,
}: {
  level: CredentialLevel;
  specialization?: string | null;
  certifiedBy?: string;
  issuedAt?: string;
  expiresAt?: string | null;
  certificateRef?: string | null;
}) {
  const c = config[level];
  const Icon = c.icon;

  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-xl p-4 text-white",
        "bg-gradient-to-br",
        c.gradient
      )}
    >
      {/* Background pattern */}
      <div className="absolute inset-0 opacity-10">
        <div className="absolute -right-4 -top-4 size-24 rounded-full border-4 border-white" />
        <div className="absolute -left-4 -bottom-4 size-32 rounded-full border-4 border-white" />
      </div>

      <div className="relative space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Icon className="size-6" />
            <div>
              <div className="font-bold text-lg">Level {c.num}</div>
              <div className="text-sm opacity-90">{c.en}</div>
            </div>
          </div>
          <div className="text-right text-sm opacity-80">
            {c.th}
          </div>
        </div>

        {specialization && (
          <div className="text-sm">
            <span className="opacity-70">สาขา: </span>
            {specialization}
          </div>
        )}

        {certificateRef && (
          <div className="text-sm">
            <span className="opacity-70">เลขที่: </span>
            {certificateRef}
          </div>
        )}

        <div className="flex items-center justify-between text-xs opacity-80">
          {certifiedBy && <span>รับรองโดย: {certifiedBy}</span>}
          {issuedAt && (
            <span>
              ออกเมื่อ:{" "}
              {new Date(issuedAt).toLocaleDateString("th-TH", {
                day: "numeric",
                month: "short",
                year: "numeric",
              })}
            </span>
          )}
        </div>

        {expiresAt && (
          <div className="text-xs">
            หมดอายุ:{" "}
            {new Date(expiresAt).toLocaleDateString("th-TH", {
              day: "numeric",
              month: "short",
              year: "numeric",
            })}
          </div>
        )}
      </div>
    </div>
  );
}

// Credential level progress (shows all 5 levels)
export function CredentialProgress({
  currentLevel,
}: {
  currentLevel: CredentialLevel;
}) {
  const currentNum = config[currentLevel].num;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        {(Object.entries(config) as [CredentialLevel, (typeof config)[CredentialLevel]][]).map(
          ([level, c]) => {
            const Icon = c.icon;
            const isActive = c.num <= currentNum;
            const isCurrent = c.num === currentNum;
            return (
              <div key={level} className="flex flex-col items-center gap-1">
                <div
                  className={cn(
                    "flex size-10 items-center justify-center rounded-full transition-all",
                    isCurrent
                      ? cn("bg-gradient-to-br text-white shadow-lg", c.gradient)
                      : isActive
                        ? cn(c.bg, c.color)
                        : "bg-muted text-muted-foreground"
                  )}
                >
                  <Icon className="size-5" />
                </div>
                <span
                  className={cn(
                    "text-[10px] font-medium text-center",
                    isCurrent ? c.color : "text-muted-foreground"
                  )}
                >
                  Lv.{c.num}
                </span>
              </div>
            );
          }
        )}
      </div>
      {/* Progress bar */}
      <div className="h-2 w-full rounded-full bg-muted overflow-hidden">
        <div
          className={cn(
            "h-full rounded-full bg-gradient-to-r transition-all",
            config[currentLevel].gradient
          )}
          style={{ width: `${(currentNum / 5) * 100}%` }}
        />
      </div>
    </div>
  );
}
