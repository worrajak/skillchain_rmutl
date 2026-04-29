"use client";

/**
 * Smart Job QR Router (client-side)
 * ==================================
 * URL: /j/<qr_token>
 *
 * Why client-side?
 * - iOS Safari has a known race condition where the first request after
 *   a fresh navigation (camera scan → Safari) can have stale cookie state.
 *   A server-side `redirect()` on that first request shows
 *   "this page couldn't load" and forces the user to manually reload.
 * - Doing the resolve via fetch + router.replace lets cookies attach
 *   before the redirect fires, and gives us a graceful retry/error UI.
 */

import { useEffect, useState, use } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2, AlertCircle, RefreshCw } from "lucide-react";

export default function JobQrRouter({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = use(params);
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [retrying, setRetrying] = useState(false);

  async function resolve() {
    setError(null);
    try {
      const res = await fetch(`/api/qr-resolve/${token}`, { cache: "no-store" });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "ไม่สามารถเปิด QR ได้");
        if (data.target) {
          // even on error API returns a fallback target
          setTimeout(() => router.replace(data.target), 1500);
        }
        return;
      }
      // Use replace so back button doesn't return to the loading page
      router.replace(data.target);
    } catch (err) {
      setError(err instanceof Error ? err.message : "เครือข่ายขัดข้อง");
    }
  }

  useEffect(() => {
    resolve();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-muted px-4">
        <Card className="max-w-md w-full">
          <CardContent className="py-8 text-center space-y-3">
            <AlertCircle className="size-10 mx-auto text-orange-500" />
            <p className="font-medium text-foreground">เปิด QR ไม่สำเร็จ</p>
            <p className="text-sm text-muted-foreground">{error}</p>
            <Button
              onClick={async () => {
                setRetrying(true);
                await resolve();
                setRetrying(false);
              }}
              disabled={retrying}
              className="mt-2"
            >
              {retrying ? (
                <><Loader2 className="size-4 mr-1 animate-spin" />กำลังลอง...</>
              ) : (
                <><RefreshCw className="size-4 mr-1" />ลองใหม่</>
              )}
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-muted px-4">
      <Card className="max-w-md w-full">
        <CardContent className="py-10 text-center space-y-3">
          <Loader2 className="size-10 mx-auto animate-spin text-blue-500" />
          <p className="font-medium text-foreground">กำลังเปิดหน้างาน...</p>
          <p className="text-xs text-muted-foreground">
            ระบบกำลังตรวจสอบ QR และนำทางไปยังหน้าที่ตรงกับสิทธิ์ของคุณ
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
