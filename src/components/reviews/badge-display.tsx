"use client";

import { cn } from "@/lib/utils";
import { Award, Shield, Star, GraduationCap } from "lucide-react";

// Badge Level Display
const badgeConfig: Record<
  string,
  { label: string; icon: typeof Award; color: string; bg: string }
> = {
  LOCKED: {
    label: "ล็อค",
    icon: Shield,
    color: "text-gray-500",
    bg: "bg-gray-100",
  },
  BASIC: {
    label: "Basic",
    icon: Award,
    color: "text-amber-600",
    bg: "bg-amber-50",
  },
  TRUSTED: {
    label: "Trusted",
    icon: Star,
    color: "text-blue-600",
    bg: "bg-blue-50",
  },
  ELITE: {
    label: "Elite",
    icon: GraduationCap,
    color: "text-purple-600",
    bg: "bg-purple-50",
  },
};

export function BadgeDisplay({
  level,
  size = "md",
}: {
  level: string;
  size?: "sm" | "md" | "lg";
}) {
  const config = badgeConfig[level] ?? badgeConfig.LOCKED;
  const Icon = config.icon;

  const sizeClasses = {
    sm: "px-2 py-0.5 text-xs gap-1",
    md: "px-3 py-1 text-sm gap-1.5",
    lg: "px-4 py-2 text-base gap-2",
  };

  const iconSize = {
    sm: "size-3",
    md: "size-4",
    lg: "size-5",
  };

  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full font-medium",
        config.bg,
        config.color,
        sizeClasses[size]
      )}
    >
      <Icon className={iconSize[size]} />
      {config.label}
    </span>
  );
}

// Tier Display
const tierConfig: Record<
  string,
  { label: string; labelTh: string; color: string; bg: string; ring: string }
> = {
  trainee: {
    label: "Trainee",
    labelTh: "ฝึกหัด",
    color: "text-gray-700",
    bg: "bg-gray-100",
    ring: "ring-gray-300",
  },
  apprentice: {
    label: "Apprentice",
    labelTh: "ช่างฝึกงาน",
    color: "text-blue-700",
    bg: "bg-blue-100",
    ring: "ring-blue-300",
  },
  certified: {
    label: "Certified",
    labelTh: "ช่างรับรอง",
    color: "text-green-700",
    bg: "bg-green-100",
    ring: "ring-green-300",
  },
};

export function TierDisplay({
  tier,
  showThai = true,
  size = "md",
}: {
  tier: string;
  showThai?: boolean;
  size?: "sm" | "md" | "lg";
}) {
  const config = tierConfig[tier] ?? tierConfig.trainee;

  const sizeClasses = {
    sm: "px-2 py-0.5 text-xs",
    md: "px-3 py-1 text-sm",
    lg: "px-4 py-2 text-base",
  };

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full font-medium ring-1",
        config.bg,
        config.color,
        config.ring,
        sizeClasses[size]
      )}
    >
      <GraduationCap className={size === "sm" ? "size-3" : "size-4"} />
      {config.label}
      {showThai && (
        <span className="opacity-70">({config.labelTh})</span>
      )}
    </span>
  );
}

// Combined score circle
export function ScoreCircle({
  score,
  max = 5,
  label,
  size = "md",
}: {
  score: number;
  max?: number;
  label?: string;
  size?: "sm" | "md" | "lg";
}) {
  const percent = (score / max) * 100;
  const circumference = 2 * Math.PI * 40;
  const dashOffset = circumference - (percent / 100) * circumference;

  const color =
    percent >= 80
      ? "stroke-green-500"
      : percent >= 60
        ? "stroke-blue-500"
        : percent >= 40
          ? "stroke-yellow-500"
          : "stroke-red-500";

  const sizeMap = {
    sm: { width: 64, fontSize: "text-sm" },
    md: { width: 80, fontSize: "text-lg" },
    lg: { width: 100, fontSize: "text-2xl" },
  };

  const s = sizeMap[size];

  return (
    <div className="flex flex-col items-center gap-1">
      <svg width={s.width} height={s.width} viewBox="0 0 100 100">
        <circle
          cx="50"
          cy="50"
          r="40"
          fill="none"
          strokeWidth="8"
          className="stroke-muted"
        />
        <circle
          cx="50"
          cy="50"
          r="40"
          fill="none"
          strokeWidth="8"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={dashOffset}
          className={cn(color, "transition-all duration-500")}
          transform="rotate(-90 50 50)"
        />
        <text
          x="50"
          y="50"
          textAnchor="middle"
          dominantBaseline="central"
          className={cn(s.fontSize, "fill-foreground font-bold")}
          style={{ fontSize: size === "sm" ? 20 : size === "md" ? 24 : 28 }}
        >
          {score.toFixed(1)}
        </text>
      </svg>
      {label && (
        <span className="text-xs text-muted-foreground text-center">
          {label}
        </span>
      )}
    </div>
  );
}
