"use client";

import { use, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CheckCircle2, AlertCircle, Loader2, LogIn, Sparkles } from "lucide-react";

/**
 * /check-in/[id] — student lands here after scanning the activity QR.
 *
 * Auto-calls POST /api/jobs/[id]/check-in.
 * If unauthenticated → redirect to /login?next=/check-in/<id>
 */
export default function CheckInPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const [state, setState] = useState<"loading" | "success" | "already" | "error" | "unauth">("loading");
  const [message, setMessage] = useState("");

  useEffect(() => {
    let cancelled = false;
    async function run() {
      try {
        const res = await fetch(`/api/jobs/${id}/check-in`, { method: "POST" });
        if (res.status === 401) {
          if (!cancelled) setState("unauth");
          return;
        }
        const data = await res.json();
        if (cancelled) return;
        if (!res.ok) {
          setState("error");
          setMessage(data.error || "Check-in ไม่สำเร็จ");
          return;
        }
        if (data.already) {
          setState("already");
          setMessage(data.message);
        } else {
          setState("success");
          setMessage(data.message);
        }
      } catch (e) {
        if (cancelled) return;
        setState("error");
        setMessage(e instanceof Error ? e.message : "เกิดข้อผิดพลาด");
      }
    }
    run();
    return () => { cancelled = true; };
  }, [id]);

  return (
    <div className="min-h-screen bg-gradient-to-b from-sky-50 to-white flex items-center justify-center px-4 py-8">
      <Card className="w-full max-w-md">
        <CardContent className="pt-8 pb-6 text-center space-y-4">
          {state === "loading" && (
            <>
              <Loader2 className="size-12 mx-auto animate-spin text-sky-500" />
              <p className="text-lg font-medium">กำลัง check-in...</p>
            </>
          )}

          {state === "success" && (
            <>
              <div className="size-16 mx-auto rounded-full bg-emerald-100 flex items-center justify-center">
                <CheckCircle2 className="size-10 text-emerald-600" />
              </div>
              <h1 className="text-2xl font-bold text-emerald-700">เช็คอินสำเร็จ! 🎉</h1>
              <p className="text-sm text-muted-foreground">{message}</p>
              <div className="rounded-lg bg-amber-50 border border-amber-200 p-3 text-xs text-amber-900 text-left">
                <Sparkles className="size-4 inline mr-1" />
                หลังจบกิจกรรม คณะทำงานจะยืนยันให้คะแนนการเข้าร่วม
                แล้วระบบจะปล่อย TRPB เข้า wallet คุณอัตโนมัติ
              </div>
              <div className="flex gap-2">
                <Link href="/student/dashboard" className="flex-1">
                  <Button variant="outline" className="w-full">หน้าหลัก</Button>
                </Link>
                <Link href="/wallet" className="flex-1">
                  <Button className="w-full">ดู Wallet</Button>
                </Link>
              </div>
            </>
          )}

          {state === "already" && (
            <>
              <div className="size-16 mx-auto rounded-full bg-sky-100 flex items-center justify-center">
                <CheckCircle2 className="size-10 text-sky-600" />
              </div>
              <h1 className="text-xl font-bold text-sky-700">เคยเช็คอินแล้ว</h1>
              <p className="text-sm text-muted-foreground">{message}</p>
              <Link href="/student/dashboard">
                <Button variant="outline" className="w-full">กลับหน้าหลัก</Button>
              </Link>
            </>
          )}

          {state === "unauth" && (
            <>
              <div className="size-16 mx-auto rounded-full bg-amber-100 flex items-center justify-center">
                <LogIn className="size-10 text-amber-600" />
              </div>
              <h1 className="text-xl font-bold">กรุณาเข้าสู่ระบบ</h1>
              <p className="text-sm text-muted-foreground">
                ล็อกอินก่อนเพื่อ check-in กิจกรรม
              </p>
              <Button onClick={() => router.push(`/login?next=/check-in/${id}`)} className="w-full">
                เข้าสู่ระบบ
              </Button>
            </>
          )}

          {state === "error" && (
            <>
              <div className="size-16 mx-auto rounded-full bg-red-100 flex items-center justify-center">
                <AlertCircle className="size-10 text-red-600" />
              </div>
              <h1 className="text-xl font-bold text-red-700">Check-in ไม่สำเร็จ</h1>
              <p className="text-sm text-muted-foreground">{message}</p>
              <Link href="/student/dashboard">
                <Button variant="outline" className="w-full">กลับหน้าหลัก</Button>
              </Link>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
