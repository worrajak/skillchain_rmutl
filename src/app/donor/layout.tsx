"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { LayoutDashboard, Heart, FileSearch, TrendingUp, LogOut, Menu, X } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { NotificationBell } from "@/components/notifications/notification-bell";
import { TrpbBalance } from "@/components/trpb-balance";
import { UserMenu } from "@/components/user-menu";

const navItems = [
  { href: "/donor/donate", label: "บริจาค", icon: Heart },
  { href: "/donor/audit", label: "ตรวจสอบการใช้เงิน", icon: FileSearch },
  { href: "/donor/impact", label: "ผลกระทบ", icon: TrendingUp },
];

export default function DonorLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  return (
    <div className="flex min-h-screen bg-muted">
      {open && <div className="fixed inset-0 z-40 bg-black/50 lg:hidden" onClick={() => setOpen(false)} />}
      <aside className={cn("fixed inset-y-0 left-0 z-50 w-64 bg-card border-r transform transition-transform lg:translate-x-0 lg:static lg:z-auto", open ? "translate-x-0" : "-translate-x-full")}>
        <div className="flex h-full flex-col">
          <div className="flex items-center justify-between border-b px-4 py-4">
            <Link href="/donor/donate" className="flex items-center gap-2">
              <Heart className="size-6 text-pink-600" />
              <span className="font-bold text-foreground">SkillChain ผู้บริจาค</span>
            </Link>
            <button className="lg:hidden" onClick={() => setOpen(false)}><X className="size-5" /></button>
          </div>
          <nav className="flex-1 overflow-y-auto p-3 space-y-1">
            {navItems.map((item) => {
              const isActive = pathname === item.href;
              return (
                <Link key={item.href} href={item.href} onClick={() => setOpen(false)}
                  className={cn("flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
                    isActive ? "bg-pink-50 text-pink-700" : "text-muted-foreground hover:bg-muted hover:text-foreground")}>
                  <item.icon className="size-4 shrink-0" />{item.label}
                </Link>
              );
            })}
          </nav>
          <div className="border-t p-3">
            <Link href="/" className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-muted-foreground hover:bg-muted hover:text-foreground">
              <LogOut className="size-4" />กลับหน้าหลัก
            </Link>
          </div>
        </div>
      </aside>
      <div className="flex-1 flex flex-col min-w-0">
        <header className="sticky top-0 z-30 flex items-center gap-4 border-b bg-card px-4 py-3 lg:px-6">
          <Button variant="ghost" size="sm" className="lg:hidden" onClick={() => setOpen(true)}><Menu className="size-5" /></Button>
          <h1 className="text-lg font-semibold text-foreground flex-1">
            {navItems.find((i) => pathname === i.href)?.label ?? "ผู้บริจาค"}
          </h1>
          <TrpbBalance />
          <NotificationBell />
          <UserMenu />
        </header>
        <main className="flex-1 p-4 lg:p-6">{children}</main>
      </div>
    </div>
  );
}
