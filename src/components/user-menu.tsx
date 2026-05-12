"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { UserAvatar } from "@/components/user-avatar";
import { UserCircle, Sparkles, Shield, LogOut, ChevronDown } from "lucide-react";

/**
 * UserMenu — avatar button at top-right of authenticated layouts.
 * Click opens a dropdown with profile + settings + logout links.
 *
 * Drop into any role layout (admin, student, employer, staff) — works for all.
 */
export function UserMenu() {
  const supabase = createClient();
  const [user, setUser] = useState<{
    id: string;
    name: string | null;
    email: string | null;
    role: string | null;
    avatar_url: string | null;
  } | null>(null);
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      const { data: { user: au } } = await supabase.auth.getUser();
      if (!au || cancelled) return;
      const { data: profile } = await supabase
        .from("skc_users")
        .select("id, name, email, role, avatar_url")
        .eq("id", au.id)
        .single();
      if (cancelled) return;
      setUser(profile);
    }
    load();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Close on outside click
  useEffect(() => {
    function handler(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    if (open) document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  async function logout() {
    await supabase.auth.signOut();
    window.location.href = "/";
  }

  if (!user) return null;

  const roleLabel: Record<string, string> = {
    student: "นักศึกษา",
    employer: "ผู้ว่าจ้าง",
    teacher: "อาจารย์",
    admin: "ผู้ดูแลระบบ",
    superadmin: "Superadmin",
    donor: "ผู้บริจาค",
    project_staff: "คณะทำงานใต้ร่มฯ",
    rmutl_staff: "คณะทำงาน มทร.",
  };

  return (
    <div ref={menuRef} className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-2 rounded-full pl-1 pr-2 py-1 hover:bg-muted transition-colors"
        aria-label="เมนูผู้ใช้"
      >
        <UserAvatar
          user={{ name: user.name, avatar_url: user.avatar_url, role: user.role }}
          size="sm"
          ring
        />
        <span className="hidden md:inline text-sm font-medium text-foreground max-w-[120px] truncate">
          {user.name ?? user.email}
        </span>
        <ChevronDown className="size-3.5 text-muted-foreground hidden md:inline" />
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-2 w-64 rounded-xl border bg-card shadow-lg overflow-hidden z-50">
          {/* Header */}
          <div className="px-4 py-3 border-b flex items-center gap-3 bg-muted/40">
            <UserAvatar
              user={{ name: user.name, avatar_url: user.avatar_url, role: user.role }}
              size="md"
              ring
            />
            <div className="flex-1 min-w-0">
              <p className="font-medium text-sm text-foreground truncate">
                {user.name ?? user.email}
              </p>
              <p className="text-[11px] text-muted-foreground truncate">{user.email}</p>
              <span className="inline-block mt-0.5 text-[10px] rounded-full bg-sky-100 text-sky-700 px-2 py-0.5">
                {roleLabel[user.role ?? ""] ?? user.role}
              </span>
            </div>
          </div>

          {/* Menu items */}
          <div className="py-1">
            <MenuItem href="/profile/edit" icon={UserCircle} label="แก้ไขโปรไฟล์" onClick={() => setOpen(false)} />
            <MenuItem href="/settings/ai" icon={Sparkles} label="ตั้งค่า AI" highlight onClick={() => setOpen(false)} />
            <MenuItem href="/profile/permissions" icon={Shield} label="สิทธิ์ + การยินยอม" onClick={() => setOpen(false)} />
          </div>

          <div className="border-t py-1">
            <button
              onClick={logout}
              className="w-full text-left flex items-center gap-3 px-4 py-2.5 text-sm text-red-600 hover:bg-red-50"
            >
              <LogOut className="size-4" />
              ออกจากระบบ
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function MenuItem({
  href,
  icon: Icon,
  label,
  highlight,
  onClick,
}: {
  href: string;
  icon: typeof UserCircle;
  label: string;
  highlight?: boolean;
  onClick?: () => void;
}) {
  return (
    <Link
      href={href}
      onClick={onClick}
      className={`flex items-center gap-3 px-4 py-2.5 text-sm hover:bg-muted transition-colors ${highlight ? "bg-amber-50/50" : ""}`}
    >
      <Icon className={`size-4 ${highlight ? "text-amber-600" : "text-muted-foreground"}`} />
      <span className="flex-1">{label}</span>
    </Link>
  );
}
