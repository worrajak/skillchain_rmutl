"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { LayoutDashboard, Briefcase, PlusCircle, Menu, X, Home } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { TrpbBalance } from "@/components/trpb-balance";
import { UserMenu } from "@/components/user-menu";

// นศ. ไม่มีในเมนูผู้จ้าง — จัดการโดย staff/admin/อาจารย์
// ผู้จ้างเห็นชื่อ นศ. ที่รับงานในการ์ดแต่ละงานอยู่แล้ว
const navItems = [
  { href: "/employer/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/employer/jobs/new", label: "ลงงานใหม่", icon: PlusCircle },
  { href: "/employer/jobs", label: "งานของฉัน", icon: Briefcase },
];

export default function EmployerLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  return (
    <div className="flex min-h-screen bg-muted">
      {open && <div className="fixed inset-0 z-40 bg-black/50 lg:hidden" onClick={() => setOpen(false)} />}
      <aside className={cn(
        "fixed inset-y-0 left-0 z-50 w-64 bg-card border-r transform transition-transform lg:translate-x-0 lg:static lg:z-auto",
        open ? "translate-x-0" : "-translate-x-full"
      )}>
        <div className="flex h-full flex-col">
          <div className="flex items-center justify-between border-b px-4 py-4">
            <Link href="/employer/dashboard" className="flex items-center gap-2">
              <Briefcase className="size-6 text-green-600" />
              <span className="font-bold text-foreground">SkillChain ผู้จ้าง</span>
            </Link>
            <button className="lg:hidden" onClick={() => setOpen(false)}><X className="size-5" /></button>
          </div>
          <div className="px-3 pt-3">
            <Link href="/" className="flex items-center gap-2 rounded-lg border px-3 py-2 text-xs font-medium text-muted-foreground hover:bg-muted hover:text-foreground">
              <Home className="size-3.5" />กลับหน้าหลัก
            </Link>
          </div>
          <nav className="flex-1 overflow-y-auto p-3 space-y-1">
            {navItems.map((item) => {
              const isActive = pathname === item.href || pathname.startsWith(item.href + "/");
              return (
                <Link key={item.href} href={item.href} onClick={() => setOpen(false)}
                  className={cn(
                    "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
                    isActive ? "bg-green-50 text-green-700" : "text-muted-foreground hover:bg-muted hover:text-foreground"
                  )}>
                  <item.icon className="size-4 shrink-0" />{item.label}
                </Link>
              );
            })}
          </nav>
        </div>
      </aside>
      <div className="flex-1 flex flex-col min-w-0">
        <header className="sticky top-0 z-30 flex items-center gap-4 border-b bg-card px-4 py-3 lg:px-6">
          <Button variant="ghost" size="sm" className="lg:hidden" onClick={() => setOpen(true)}><Menu className="size-5" /></Button>
          <h1 className="text-lg font-semibold text-foreground flex-1">
            {navItems.find((i) => pathname.startsWith(i.href))?.label ?? "ผู้จ้าง"}
          </h1>
          <TrpbBalance />
          <UserMenu />
        </header>
        <main className="flex-1 p-4 lg:p-6">{children}</main>
      </div>
    </div>
  );
}
