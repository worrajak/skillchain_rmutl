"use client";
import { Shield } from "lucide-react";
import { UserAvatar } from "./user-avatar";

/**
 * StaffSupervisorBadge — small pill showing the project staff who supervises
 * a job. Now optionally includes the staff's profile avatar.
 */
export function StaffSupervisorBadge({
  name,
  userId,
}: {
  name: string | null | undefined;
  userId?: string | null;
}) {
  if (!name && !userId) return null;
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-purple-100 border border-purple-200 px-2 py-0.5 text-xs font-medium text-purple-800">
      {userId ? (
        <UserAvatar userId={userId} size="xs" />
      ) : (
        <Shield className="size-3" />
      )}
      {name ?? "ผู้กำกับ"}
    </span>
  );
}
