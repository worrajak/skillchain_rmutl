"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Home, Briefcase, Wallet, User, ScanLine } from "lucide-react";
import { cn } from "@/lib/utils";
import { createClient } from "@/lib/supabase/client";

/**
 * Mobile bottom tab bar — fixed to bottom of viewport on small screens.
 * Hidden on desktop (md:hidden). Visible on all authenticated pages.
 *
 * Center "scan" FAB is role-aware:
 *   - student → /student/scan (scan job QR to check-in/submit)
 *   - employer → /employer/scan (scan student QR to confirm)
 *   - staff → /project-staff/scan (scan job QR for review)
 *   - admin → /admin/wallets (default to wallet management)
 */

interface Tab {
  href: string;
  icon: typeof Home;
  label: string;
}

function tabsFor(role: string | null): { left: Tab[]; right: Tab[]; scanHref: string } {
  if (role === "student") {
    return {
      left: [
        { href: "/student/dashboard", icon: Home, label: "หน้าหลัก" },
        { href: "/student/jobs", icon: Briefcase, label: "งาน" },
      ],
      right: [
        { href: "/wallet", icon: Wallet, label: "Wallet" },
        { href: "/profile", icon: User, label: "ฉัน" },
      ],
      scanHref: "/scan",
    };
  }
  if (role === "employer") {
    return {
      left: [
        { href: "/employer/dashboard", icon: Home, label: "หน้าหลัก" },
        { href: "/employer/jobs", icon: Briefcase, label: "งานของฉัน" },
      ],
      right: [
        { href: "/wallet", icon: Wallet, label: "Wallet" },
        { href: "/profile", icon: User, label: "ฉัน" },
      ],
      scanHref: "/scan",
    };
  }
  if (role === "project_staff" || role === "rmutl_staff") {
    return {
      left: [
        { href: "/project-staff/dashboard", icon: Home, label: "หน้าหลัก" },
        { href: "/project-staff/active-jobs", icon: Briefcase, label: "งาน" },
      ],
      right: [
        { href: "/wallet", icon: Wallet, label: "Wallet" },
        { href: "/profile", icon: User, label: "ฉัน" },
      ],
      scanHref: "/scan",
    };
  }
  if (role === "admin" || role === "superadmin") {
    return {
      left: [
        { href: "/admin/dashboard", icon: Home, label: "หน้าหลัก" },
        { href: "/admin/wallets", icon: Briefcase, label: "Wallets" },
      ],
      right: [
        { href: "/admin/trpb", icon: Wallet, label: "TRPB" },
        { href: "/profile", icon: User, label: "ฉัน" },
      ],
      scanHref: "/admin/wallets",
    };
  }
  // Default (donor / teacher / unauthenticated fallback)
  return {
    left: [
      { href: "/dashboard", icon: Home, label: "หน้าหลัก" },
      { href: "/wallet", icon: Wallet, label: "Wallet" },
    ],
    right: [
      { href: "/verify", icon: Briefcase, label: "ตรวจสอบ" },
      { href: "/profile", icon: User, label: "ฉัน" },
    ],
    scanHref: "/verify",
  };
}

export function MobileTabBar() {
  const pathname = usePathname() ?? "";
  const router = useRouter();
  const [role, setRole] = useState<string | null>(null);
  const [authed, setAuthed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (cancelled || !user) return;
      setAuthed(true);
      const { data: profile } = await supabase
        .from("skc_users")
        .select("role")
        .eq("id", user.id)
        .single();
      if (!cancelled && profile?.role) setRole(profile.role as string);
    }
    load();
    return () => { cancelled = true; };
  }, [pathname]);

  // Hide on auth pages + landing + print/guides
  const HIDE_ON = ["/login", "/register", "/verify", "/quick-login", "/j/", "/guides/"];
  if (HIDE_ON.some((p) => pathname.startsWith(p))) return null;
  if (pathname === "/") return null;
  if (!authed) return null;

  const { left, right, scanHref } = tabsFor(role);

  function isActive(href: string) {
    if (href === pathname) return true;
    // Treat /student/jobs/123 as active for /student/jobs
    if (href !== "/" && pathname.startsWith(href)) return true;
    return false;
  }

  return (
    <>
      {/* Spacer so content isn't hidden behind the bar */}
      <div className="md:hidden h-20" aria-hidden />

      <nav
        className="md:hidden fixed bottom-0 inset-x-0 z-40 border-t bg-card/95 backdrop-blur supports-[backdrop-filter]:bg-card/80"
        style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
        aria-label="Bottom navigation"
      >
        <div className="grid grid-cols-5 items-end h-16 max-w-md mx-auto relative">
          {left.map((t) => (
            <TabLink key={t.href} {...t} active={isActive(t.href)} />
          ))}

          {/* Center FAB — slightly raised */}
          <button
            onClick={() => router.push(scanHref)}
            className="absolute left-1/2 -translate-x-1/2 -top-5 size-14 rounded-full shadow-lg flex flex-col items-center justify-center bg-gradient-to-br from-sky-500 to-blue-600 text-white ring-4 ring-card hover:from-sky-400 hover:to-blue-500 transition-all"
            aria-label="สแกน QR"
          >
            <ScanLine className="size-6" />
          </button>
          {/* placeholder column */}
          <div aria-hidden />

          {right.map((t) => (
            <TabLink key={t.href} {...t} active={isActive(t.href)} />
          ))}
        </div>
      </nav>
    </>
  );
}

function TabLink({
  href,
  icon: Icon,
  label,
  active,
}: {
  href: string;
  icon: typeof Home;
  label: string;
  active: boolean;
}) {
  return (
    <Link
      href={href}
      className={cn(
        "flex flex-col items-center justify-center h-full gap-0.5 text-[10px] transition-colors",
        active ? "text-sky-600" : "text-muted-foreground hover:text-foreground",
      )}
    >
      <Icon className={cn("size-5", active && "stroke-[2.5]")} />
      <span className={cn(active && "font-medium")}>{label}</span>
    </Link>
  );
}
