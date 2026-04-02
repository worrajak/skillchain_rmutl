"use client";

import { useState } from "react";
import { Star } from "lucide-react";
import { cn } from "@/lib/utils";

interface StarRatingProps {
  value: number;
  max?: number;
  size?: "sm" | "md" | "lg";
  readOnly?: boolean;
  onChange?: (value: number) => void;
  showValue?: boolean;
  label?: string;
}

const sizeMap = {
  sm: "size-4",
  md: "size-5",
  lg: "size-7",
};

export function StarRating({
  value,
  max = 5,
  size = "md",
  readOnly = false,
  onChange,
  showValue = false,
  label,
}: StarRatingProps) {
  const [hoverValue, setHoverValue] = useState(0);

  const displayValue = hoverValue || value;

  return (
    <div className="flex flex-col gap-1">
      {label && (
        <span className="text-sm font-medium text-foreground">{label}</span>
      )}
      <div className="flex items-center gap-0.5">
        {Array.from({ length: max }, (_, i) => {
          const starIndex = i + 1;
          const isFilled = starIndex <= displayValue;
          const isHalf =
            !isFilled && starIndex - 0.5 <= displayValue && displayValue < starIndex;

          return (
            <button
              key={i}
              type="button"
              disabled={readOnly}
              className={cn(
                "transition-colors",
                readOnly ? "cursor-default" : "cursor-pointer hover:scale-110"
              )}
              onMouseEnter={() => !readOnly && setHoverValue(starIndex)}
              onMouseLeave={() => !readOnly && setHoverValue(0)}
              onClick={() => !readOnly && onChange?.(starIndex)}
            >
              <Star
                className={cn(
                  sizeMap[size],
                  isFilled
                    ? "fill-yellow-400 text-yellow-400"
                    : isHalf
                      ? "fill-yellow-400/50 text-yellow-400"
                      : "fill-transparent text-gray-300"
                )}
              />
            </button>
          );
        })}
        {showValue && (
          <span className="ml-1.5 text-sm font-semibold text-foreground">
            {value.toFixed(1)}
          </span>
        )}
      </div>
    </div>
  );
}

// Compact display version (e.g. "4.3 ★★★★☆ (12)")
export function StarRatingCompact({
  value,
  count,
  size = "sm",
}: {
  value: number;
  count?: number;
  size?: "sm" | "md";
}) {
  return (
    <div className="flex items-center gap-1.5">
      <span className="font-bold text-foreground">{value.toFixed(1)}</span>
      <div className="flex gap-0.5">
        {Array.from({ length: 5 }, (_, i) => (
          <Star
            key={i}
            className={cn(
              sizeMap[size],
              i + 1 <= Math.round(value)
                ? "fill-yellow-400 text-yellow-400"
                : "fill-transparent text-gray-300"
            )}
          />
        ))}
      </div>
      {count !== undefined && (
        <span className="text-xs text-muted-foreground">({count})</span>
      )}
    </div>
  );
}
