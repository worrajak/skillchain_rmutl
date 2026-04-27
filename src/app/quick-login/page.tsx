"use client";

import { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import dynamic from "next/dynamic";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import Link from "next/link";

const QrScanner = dynamic(() => import("@/components/qr-scanner"), { ssr: false });

function QuickLoginContent() {
  const router = useRouter();
  const search = useSearchParams();
  const next = search.get("next") ?? "/";

  const [step, setStep] = useState<"scan" | "pin">("scan");
  const [qrToken, setQrToken] = useState<string>("");
  const [user, setUser] = useState<{ name: string; role: string } | null>(null);
  const [pin, setPin] = useState("");
  const [loading, setLoading] = useState(false);
  const [showManualEntry, setShowManualEntry] = useState(false);

  // Auto-login if ?qr=xxx in URL
  useEffect(() => {
    const urlQr = search.get("qr");
    if (urlQr && step === "scan") {
      handleQrFound(urlQr);
    }
  }, [search]);

  async function handleQrFound(token: string) {
    // If full URL was scanned, extract token
    let cleanToken = token;
    const m = token.match(/\/quick-login\?qr=([^&]+)/);
    if (m) cleanToken = m[1];
    const m2 = token.match(/\/j\/([^/?]+)/);
    if (m2) {
      // Job QR scanned — redirect to /j/<token>
      router.push(`/j/${m2[1]}`);
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/quick-auth/lookup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ qr_token: cleanToken }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error ?? "QR ไม่ถูกต้อง");
        return;
      }
      setQrToken(cleanToken);
      setUser({ name: data.name, role: data.role });
      setStep("pin");
    } finally {
      setLoading(false);
    }
  }

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    if (pin.length !== 6) {
      toast.error("PIN ต้องเป็น 6 หลัก");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/quick-auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ qr_token: qrToken, pin }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error ?? "เข้าสู่ระบบไม่สำเร็จ");
        if (data.attempts_left !== undefined) {
          toast.warning(`เหลือโอกาสอีก ${data.attempts_left} ครั้ง`);
        }
        setPin("");
        return;
      }

      toast.success(`ยินดีต้อนรับ ${data.user.name}!`);
      router.push(next);
      router.refresh();
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted px-4 py-8">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl">SkillChain เข้าสู่ระบบ</CardTitle>
          <CardDescription>
            {step === "scan" ? "สแกน QR Code ของคุณ" : `ยินดีต้อนรับ ${user?.name}`}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {step === "scan" ? (
            <>
              <QrScanner
                onScan={handleQrFound}
                onError={(e) => toast.error(e)}
              />

              <div className="text-center text-sm text-muted-foreground">หรือ</div>

              {!showManualEntry ? (
                <Button
                  variant="outline"
                  className="w-full"
                  onClick={() => setShowManualEntry(true)}
                >
                  พิมพ์รหัส QR ด้วยตัวเอง
                </Button>
              ) : (
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    const data = new FormData(e.currentTarget);
                    handleQrFound((data.get("qr") as string).trim());
                  }}
                  className="space-y-2"
                >
                  <Input
                    name="qr"
                    placeholder="พิมพ์รหัส QR (ตัวอักษร 12 ตัว)"
                    autoComplete="off"
                  />
                  <Button type="submit" className="w-full" disabled={loading}>
                    ตรวจสอบ
                  </Button>
                </form>
              )}

              <div className="pt-3 border-t text-center text-sm">
                <Link href="/login" className="text-blue-600 hover:underline">
                  เข้าสู่ระบบด้วย Email + Password (Staff)
                </Link>
              </div>
            </>
          ) : (
            <form onSubmit={handleLogin} className="space-y-4">
              <div className="bg-blue-50 p-3 rounded text-sm">
                <div className="font-medium">{user?.name}</div>
                <div className="text-xs text-muted-foreground">{user?.role}</div>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">รหัส PIN 6 หลัก</label>
                <Input
                  type="text"
                  inputMode="numeric"
                  pattern="\d{6}"
                  maxLength={6}
                  value={pin}
                  onChange={(e) => setPin(e.target.value.replace(/\D/g, ""))}
                  className="text-center text-2xl tracking-widest font-mono"
                  placeholder="••••••"
                  autoFocus
                  required
                />
              </div>

              <Button type="submit" className="w-full" size="lg" disabled={loading || pin.length !== 6}>
                {loading ? "กำลังเข้าสู่ระบบ..." : "เข้าสู่ระบบ"}
              </Button>

              <Button
                type="button"
                variant="outline"
                className="w-full"
                onClick={() => {
                  setStep("scan");
                  setUser(null);
                  setQrToken("");
                  setPin("");
                }}
              >
                ← เปลี่ยน QR Code
              </Button>

              <div className="text-xs text-muted-foreground text-center">
                ลืม PIN? กรุณาติดต่อเจ้าหน้าที่โครงการ
              </div>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

export default function QuickLoginPage() {
  return (
    <Suspense fallback={<div className="flex min-h-screen items-center justify-center">กำลังโหลด...</div>}>
      <QuickLoginContent />
    </Suspense>
  );
}
