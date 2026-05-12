"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowLeft, AlertCircle, Loader2, ScanLine } from "lucide-react";
import Link from "next/link";

// Dynamic import — qr-scanner uses MediaDevices.getUserMedia (browser only)
const QrScanner = dynamic(() => import("@/components/qr-scanner"), {
  ssr: false,
  loading: () => (
    <div className="flex items-center justify-center py-16">
      <Loader2 className="size-6 animate-spin text-sky-500" />
    </div>
  ),
});

/**
 * Universal scan page — entry point from the mobile bottom-tab FAB.
 *
 * Behavior:
 *   - Opens camera fullscreen
 *   - Decodes QR
 *   - If QR is a /j/[token] link → resolve via /api/qr-resolve and redirect
 *   - If QR is a raw token → same
 *   - Otherwise show "ลิงก์ไม่ใช่ของระบบ"
 */
export default function ScanPage() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [resolving, setResolving] = useState(false);

  async function handleScanned(decoded: string) {
    setResolving(true);
    setError(null);

    // Extract token: support full URL https://.../j/TOKEN, /j/TOKEN, or raw TOKEN
    let token = decoded.trim();
    const m = token.match(/\/j\/([A-Za-z0-9_-]+)/);
    if (m) token = m[1];
    if (!/^[A-Za-z0-9_-]+$/.test(token)) {
      setError("QR นี้ไม่ใช่ของระบบ SkillChain");
      setResolving(false);
      return;
    }

    try {
      const res = await fetch(`/api/qr-resolve/${token}`);
      const data = await res.json();
      if (!res.ok || !data.target) {
        setError(data.error || "QR ไม่ถูกต้องหรือหมดอายุ");
        setResolving(false);
        return;
      }
      router.push(data.target);
    } catch {
      setError("เกิดข้อผิดพลาด — ลองอีกครั้ง");
      setResolving(false);
    }
  }

  return (
    <div className="container max-w-md mx-auto px-4 py-6 space-y-4">
      <div className="flex items-center gap-2">
        <Link href="/">
          <Button variant="ghost" size="sm">
            <ArrowLeft className="size-4 mr-1" />
            กลับ
          </Button>
        </Link>
        <h1 className="text-xl font-bold flex items-center gap-2">
          <ScanLine className="size-6 text-sky-500" />
          สแกน QR
        </h1>
      </div>

      <Card className="border-sky-200 bg-sky-50/40">
        <CardContent className="pt-5 space-y-1 text-sm">
          <p className="font-medium text-foreground">📷 เปิดกล้องสแกน QR ของงาน</p>
          <p className="text-xs text-muted-foreground">
            ระบบจะเปิดงานที่ตรงกับสิทธิ์ของคุณโดยอัตโนมัติ — เช็คอิน, ส่งงาน, ยืนยันรับงาน, อนุมัติ
          </p>
        </CardContent>
      </Card>

      {error && (
        <Card className="border-red-200 bg-red-50">
          <CardContent className="pt-4 flex items-start gap-2 text-sm text-red-700">
            <AlertCircle className="size-5 shrink-0" />
            <div>
              <p className="font-medium">{error}</p>
              <Button
                onClick={() => setError(null)}
                size="sm"
                variant="outline"
                className="mt-2"
              >
                ลองสแกนอีกครั้ง
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {resolving ? (
        <Card>
          <CardContent className="py-12 flex flex-col items-center gap-3">
            <Loader2 className="size-8 animate-spin text-sky-500" />
            <p className="text-sm text-muted-foreground">กำลังเปิดงาน...</p>
          </CardContent>
        </Card>
      ) : !error ? (
        <QrScanner onScan={handleScanned} onError={(e) => setError(e)} />
      ) : null}

      <p className="text-xs text-center text-muted-foreground">
        หรือกรอกรหัสด้วยตัวเอง:
        <Link href="/verify" className="text-sky-600 hover:underline ml-1">
          ตรวจสอบใบรับรอง
        </Link>
      </p>
    </div>
  );
}
