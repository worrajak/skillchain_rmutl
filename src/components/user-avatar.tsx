"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";

/**
 * UserAvatar — a single round avatar with graceful fallback.
 *
 * Modes:
 *   - Pass `user` directly (name + avatar_url) — no DB hit
 *   - Pass `userId` only — fetches from skc_users (cached per id in module scope)
 *
 * Fallback when no avatar:
 *   - Show first letter of name on a category-colored gradient
 *
 * Sizes:
 *   - "xs" 24px | "sm" 32px | "md" 40px | "lg" 56px | "xl" 80px
 */

const SIZE_MAP = {
  xs: "size-6 text-[10px]",
  sm: "size-8 text-xs",
  md: "size-10 text-sm",
  lg: "size-14 text-lg",
  xl: "size-20 text-2xl",
} as const;

export type AvatarSize = keyof typeof SIZE_MAP;

// Cache to avoid re-fetching the same user 10× per page
const userCache = new Map<string, { name: string | null; avatar_url: string | null; role?: string | null }>();
const pending = new Map<string, Promise<void>>();

async function fetchUser(id: string) {
  if (userCache.has(id)) return;
  const existing = pending.get(id);
  if (existing) return existing;
  const p = (async () => {
    const supabase = createClient();
    const { data } = await supabase
      .from("skc_users")
      .select("name, avatar_url, role")
      .eq("id", id)
      .maybeSingle();
    userCache.set(id, {
      name: data?.name ?? null,
      avatar_url: data?.avatar_url ?? null,
      role: data?.role ?? null,
    });
    pending.delete(id);
  })();
  pending.set(id, p);
  return p;
}

interface UserAvatarProps {
  userId?: string | null;
  user?: { name?: string | null; avatar_url?: string | null; role?: string | null } | null;
  size?: AvatarSize;
  className?: string;
  ring?: boolean; // adds outer ring
  fallbackBg?: string; // custom bg gradient classes
  title?: string;
}

const ROLE_BG: Record<string, string> = {
  student: "from-sky-400 to-blue-600",
  employer: "from-emerald-400 to-green-600",
  teacher: "from-purple-400 to-fuchsia-600",
  project_staff: "from-amber-400 to-orange-600",
  rmutl_staff: "from-amber-400 to-orange-600",
  admin: "from-slate-500 to-slate-700",
  superadmin: "from-slate-600 to-slate-800",
  donor: "from-rose-400 to-pink-600",
};

export function UserAvatar({
  userId,
  user,
  size = "md",
  className,
  ring = false,
  fallbackBg,
  title,
}: UserAvatarProps) {
  const [fetched, setFetched] = useState<{ name: string | null; avatar_url: string | null; role?: string | null } | null>(null);

  useEffect(() => {
    if (!userId || user) return;
    if (userCache.has(userId)) {
      setFetched(userCache.get(userId)!);
      return;
    }
    let cancelled = false;
    fetchUser(userId).then(() => {
      if (cancelled) return;
      setFetched(userCache.get(userId)!);
    });
    return () => { cancelled = true; };
  }, [userId, user]);

  const resolved = user ?? fetched ?? {};
  const name = resolved.name ?? "?";
  const avatar = resolved.avatar_url ?? null;
  const role = resolved.role ?? "default";
  const initial = name.charAt(0).toUpperCase();
  const bg = fallbackBg ?? ROLE_BG[role] ?? "from-slate-400 to-slate-600";

  return (
    <div
      className={cn(
        "rounded-full overflow-hidden shrink-0 flex items-center justify-center font-bold text-white bg-gradient-to-br",
        SIZE_MAP[size],
        bg,
        ring && "ring-2 ring-white shadow-sm",
        className,
      )}
      title={title ?? name}
    >
      {avatar ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={avatar} alt={name} className="w-full h-full object-cover" />
      ) : (
        <span>{initial}</span>
      )}
    </div>
  );
}

/**
 * AvatarTrio — common "3 actor strip" used on job cards / detail:
 *   นศ. · ผู้จ้าง · ผู้กำกับ
 * Each avatar links to the user's public profile.
 */
export function AvatarTrio({
  studentId,
  employerId,
  supervisorId,
  size = "sm",
  showLabels = false,
}: {
  studentId?: string | null;
  employerId?: string | null;
  supervisorId?: string | null;
  size?: AvatarSize;
  showLabels?: boolean;
}) {
  return (
    <div className="flex items-center gap-2">
      {studentId && (
        <div className="flex flex-col items-center gap-0.5">
          <UserAvatar userId={studentId} size={size} ring title="นศ." />
          {showLabels && <span className="text-[9px] text-muted-foreground">นศ.</span>}
        </div>
      )}
      {employerId && (
        <div className="flex flex-col items-center gap-0.5">
          <UserAvatar userId={employerId} size={size} ring title="ผู้จ้าง" />
          {showLabels && <span className="text-[9px] text-muted-foreground">ผู้จ้าง</span>}
        </div>
      )}
      {supervisorId && (
        <div className="flex flex-col items-center gap-0.5">
          <UserAvatar userId={supervisorId} size={size} ring title="ผู้กำกับ" />
          {showLabels && <span className="text-[9px] text-muted-foreground">ผู้กำกับ</span>}
        </div>
      )}
    </div>
  );
}
