"use client";

import { useEffect, useState } from "react";
import PermissionsChecklist from "@/components/permissions-checklist";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { ArrowLeft, ShieldQuestion } from "lucide-react";

export default function MyPermissionsPage() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [showAll, setShowAll] = useState(false);

  useEffect(() => {
    fetch("/api/permissions/me")
      .then((r) => r.json())
      .then((d) => {
        setData(d);
        setLoading(false);
      });
  }, []);

  if (loading) {
    return <div className="p-8 text-center text-muted-foreground">กำลังโหลด...</div>;
  }

  if (!data?.user) {
    return (
      <div className="p-8 text-center">
        <p>ไม่พบข้อมูล กรุณาเข้าสู่ระบบ</p>
        <Link href="/login">
          <Button className="mt-4">เข้าสู่ระบบ</Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="container max-w-3xl mx-auto py-8 px-4">
      <Link href="/" className="text-sm text-muted-foreground hover:underline flex items-center gap-1 mb-4">
        <ArrowLeft className="size-4" />
        กลับ
      </Link>

      <div className="mb-6">
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <ShieldQuestion className="size-7 text-blue-600" />
          สิทธิ์การใช้งานของฉัน
        </h1>
        <p className="text-muted-foreground mt-1">
          รายการสิทธิ์ที่คุณสามารถทำได้ในระบบ — แสดงตามบทบาทและที่ admin มอบเพิ่มเติม
        </p>
      </div>

      <Card className="mb-4">
        <CardContent className="py-4 flex items-center justify-between flex-wrap gap-3">
          <div className="text-sm">
            <strong>คุณมี {data.permissions.length} สิทธิ์</strong> จากทั้งหมด {data.catalog.length} สิทธิ์ในระบบ
          </div>
          <Button variant="outline" size="sm" onClick={() => setShowAll(!showAll)}>
            {showAll ? "ซ่อนสิทธิ์ที่ไม่มี" : "ดูสิทธิ์ทั้งหมด"}
          </Button>
        </CardContent>
      </Card>

      <PermissionsChecklist
        permissions={data.permissions}
        catalog={data.catalog}
        userName={data.user.name}
        userRole={data.user.role}
        showAll={showAll}
      />

      <div className="mt-6 text-xs text-center text-muted-foreground">
        💡 ต้องการสิทธิ์เพิ่มเติม? ติดต่อ admin ของระบบ
      </div>
    </div>
  );
}
