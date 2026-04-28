"use client";

import { useEffect, useState } from "react";
import { ShieldCheck } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Badge } from "@/components/ui/badge";
import { PERMISSION_CATEGORIES } from "@/lib/permissions";
import Link from "next/link";

/**
 * Header dropdown showing user's permissions count + quick view.
 * Click → see categories breakdown
 * "ดูทั้งหมด" → /profile/permissions
 */
export default function PermissionsBadge() {
  const [data, setData] = useState<any>(null);

  useEffect(() => {
    fetch("/api/permissions/me")
      .then((r) => r.json())
      .then(setData)
      .catch(() => {});
  }, []);

  if (!data?.permissions) return null;

  // Count by category
  const byCategory: Record<string, number> = {};
  for (const p of data.permissions) {
    const cat = p.info?.category ?? "other";
    byCategory[cat] = (byCategory[cat] || 0) + 1;
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger className="relative inline-flex items-center gap-1 px-2 py-1 rounded hover:bg-accent text-sm">
        <ShieldCheck className="size-5 text-blue-600" />
        <Badge variant="secondary" className="text-xs">
          {data.permissions.length}
        </Badge>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-72" align="end">
        <DropdownMenuLabel className="flex items-center gap-2">
          <ShieldCheck className="size-4 text-blue-600" />
          สิทธิ์ของคุณ ({data.permissions.length})
        </DropdownMenuLabel>
        <DropdownMenuSeparator />

        {Object.entries(PERMISSION_CATEGORIES)
          .sort(([, a], [, b]) => a.order - b.order)
          .map(([key, info]) => {
            const count = byCategory[key] || 0;
            if (count === 0) return null;
            return (
              <DropdownMenuItem key={key} className="flex justify-between cursor-default">
                <span>
                  {info.icon} {info.label_th}
                </span>
                <Badge variant="outline">{count}</Badge>
              </DropdownMenuItem>
            );
          })}

        <DropdownMenuSeparator />
        <Link href="/profile/permissions" className="block w-full">
          <DropdownMenuItem className="text-center justify-center text-blue-600 cursor-pointer">
            ดูสิทธิ์ทั้งหมด →
          </DropdownMenuItem>
        </Link>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
