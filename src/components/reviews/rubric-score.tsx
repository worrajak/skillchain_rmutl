"use client";

import { cn } from "@/lib/utils";

interface RubricLevel {
  value: number;
  label: string;
  description: string;
}

interface RubricScoreProps {
  label: string;
  value: number;
  levels: RubricLevel[];
  readOnly?: boolean;
  onChange?: (value: number) => void;
}

const levelColors: Record<number, string> = {
  1: "bg-red-100 text-red-800 border-red-300",
  2: "bg-yellow-100 text-yellow-800 border-yellow-300",
  3: "bg-blue-100 text-blue-800 border-blue-300",
  4: "bg-green-100 text-green-800 border-green-300",
};

const levelColorsFilled: Record<number, string> = {
  1: "bg-red-500 text-white border-red-600",
  2: "bg-yellow-500 text-white border-yellow-600",
  3: "bg-blue-500 text-white border-blue-600",
  4: "bg-green-500 text-white border-green-600",
};

export function RubricScore({
  label,
  value,
  levels,
  readOnly = false,
  onChange,
}: RubricScoreProps) {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium text-foreground">{label}</span>
        {value > 0 && (
          <span className="text-xs text-muted-foreground">
            {levels.find((l) => l.value === value)?.label}
          </span>
        )}
      </div>
      <div className="flex gap-2">
        {levels.map((level) => {
          const isSelected = level.value === value;
          return (
            <button
              key={level.value}
              type="button"
              disabled={readOnly}
              onClick={() => !readOnly && onChange?.(level.value)}
              className={cn(
                "flex-1 rounded-md border px-2 py-2 text-center text-xs font-medium transition-all",
                isSelected
                  ? levelColorsFilled[level.value]
                  : levelColors[level.value],
                !readOnly && "cursor-pointer hover:opacity-80",
                readOnly && "cursor-default"
              )}
              title={level.description}
            >
              <div className="font-bold">{level.value}</div>
              <div className="mt-0.5 text-[10px] leading-tight opacity-80">
                {level.label}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

// Compact bar display
export function RubricBar({
  label,
  value,
  max = 4,
}: {
  label: string;
  value: number;
  max?: number;
}) {
  const percent = (value / max) * 100;
  const color =
    value >= 3.5
      ? "bg-green-500"
      : value >= 2.5
        ? "bg-blue-500"
        : value >= 1.5
          ? "bg-yellow-500"
          : "bg-red-500";

  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-xs">
        <span className="text-muted-foreground">{label}</span>
        <span className="font-semibold text-foreground">
          {value.toFixed(1)}/{max}
        </span>
      </div>
      <div className="h-2 w-full rounded-full bg-muted">
        <div
          className={cn("h-2 rounded-full transition-all", color)}
          style={{ width: `${percent}%` }}
        />
      </div>
    </div>
  );
}

// Default rubric levels for different review types
export const TEACHER_RUBRIC_LEVELS: RubricLevel[] = [
  { value: 1, label: "ปรับปรุง", description: "ต้องปรับปรุงอย่างมาก" },
  { value: 2, label: "พอใช้", description: "ทำได้แต่ต้องมีคนช่วย" },
  { value: 3, label: "ดี", description: "ทำได้ดีตามมาตรฐาน" },
  { value: 4, label: "เยี่ยม", description: "ทำได้เกินความคาดหมาย" },
];

export const MENTOR_RUBRIC_LEVELS: RubricLevel[] = [
  { value: 1, label: "ปรับปรุง", description: "ต้องกำกับตลอด" },
  { value: 2, label: "พอใช้", description: "ต้องคอยแนะนำบ้าง" },
  { value: 3, label: "ดี", description: "ทำได้ด้วยตัวเอง" },
  { value: 4, label: "เยี่ยม", description: "ทำได้ดี สอนคนอื่นได้" },
];
