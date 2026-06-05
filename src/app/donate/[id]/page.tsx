"use client";

import { use, useEffect, useState } from "react";
import Link from "next/link";
import { QRCodeSVG } from "qrcode.react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Upload, CheckCircle2, AlertCircle, Loader2, Copy } from "lucide-react";
import { toast } from "sonner";

interface Payment {
  id: string;
  amount: number;
  reference: string;
  qr_payload: string;
  status: string;
  expires_at: string;
  slip_url: string | null;
  verify_result: Record<string, unknown> | null;
  rejection_reason: string | null;
}

export default function DonateQrPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [payment, setPayment] = useState<Payment | null>(null);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);

  async function load() {
    const res = await fetch(`/api/payments/${id}`);
    if (res.ok) setPayment(await res.json());
    setLoading(false);
  }

  useEffect(() => {
    load();
    // Poll every 5s if still PENDING
    const interval = setInterval(() => {
      if (payment?.status === "PENDING") load();
    }, 5000);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  async function handleUpload(file: File) {
    if (file.size > 5 * 1024 * 1024) {
      toast.error("ไฟล์ใหญ่เกิน 5 MB");
      return;
    }

    setUploading(true);
    const reader = new FileReader();
    reader.onload = async () => {
      const base64 = reader.result as string;
      const res = await fetch(`/api/payments/${id}/slip`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ image_base64: base64 }),
      });
      const data = await res.json();
      setUploading(false);

      if (!res.ok) {
        toast.error(data.error || "Upload ไม่สำเร็จ");
        return;
      }

      if (data.status === "VERIFIED") {
        toast.success("✅ ตรวจ slip ผ่าน — รอ admin ยืนยัน");
      } else {
        toast.success("📥 รับ slip แล้ว — รอ admin ตรวจสอบ");
      }
      await load();
    };
    reader.readAsDataURL(file);
  }

  function copyRef() {
    if (!payment) return;
    navigator.clipboard.writeText(payment.reference);
    toast.success("คัดลอก ref แล้ว");
  }

  if (loading || !payment) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="size-8 animate-spin text-pink-500" />
      </div>
    );
  }

  const statusInfo: Record<string, { label: string; color: string; icon: typeof CheckCircle2 }> = {
    PENDING: { label: "รอจ่ายเงิน", color: "bg-amber-100 text-amber-800 border-amber-300", icon: AlertCircle },
    SLIP_UPLOADED: { label: "ส่ง slip แล้ว · รอ admin ตรวจ", color: "bg-blue-100 text-blue-800 border-blue-300", icon: Loader2 },
    VERIFIED: { label: "ตรวจสอบผ่าน · รอ admin ยืนยัน", color: "bg-purple-100 text-purple-800 border-purple-300", icon: CheckCircle2 },
    CONFIRMED: { label: "✅ ยืนยันแล้ว · ขอบคุณ!", color: "bg-emerald-100 text-emerald-800 border-emerald-300", icon: CheckCircle2 },
    FAILED: { label: "❌ ไม่ผ่าน", color: "bg-red-100 text-red-800 border-red-300", icon: AlertCircle },
    EXPIRED: { label: "หมดอายุ", color: "bg-slate-100 text-slate-700 border-slate-300", icon: AlertCircle },
  };
  const s = statusInfo[payment.status] ?? statusInfo.PENDING;
  const StatusIcon = s.icon;

  return (
    <div className="min-h-screen bg-gradient-to-b from-pink-50 to-rose-50">
      <header className="bg-gradient-to-r from-pink-500 to-rose-600 text-white">
        <div className="max-w-2xl mx-auto px-4 py-4 flex items-center">
          <Link href="/donate">
            <Button variant="ghost" size="sm" className="text-white/80 hover:text-white hover:bg-white/10 -ml-2">
              <ArrowLeft className="size-4 mr-1" />ย้อนกลับ
            </Button>
          </Link>
          <span className="font-semibold ml-2">บริจาคผ่าน PromptPay</span>
        </div>
      </header>

      <main className="max-w-md mx-auto px-4 py-6 space-y-4">
        {/* Status badge */}
        <div className={`rounded-lg border-2 px-4 py-3 flex items-center gap-2 ${s.color}`}>
          <StatusIcon className={`size-5 shrink-0 ${payment.status === "SLIP_UPLOADED" || payment.status === "VERIFIED" ? "animate-pulse" : ""}`} />
          <span className="font-semibold text-sm">{s.label}</span>
        </div>

        {/* QR Code */}
        {payment.status === "PENDING" && (
          <Card>
            <CardContent className="pt-6 pb-5 space-y-4">
              <div className="text-center space-y-1">
                <p className="text-xs text-muted-foreground">จำนวนเงิน</p>
                <p className="text-3xl font-bold text-pink-600">฿{Number(payment.amount).toLocaleString()}</p>
              </div>

              <div className="flex justify-center">
                <div className="bg-white p-4 rounded-xl border-4 border-pink-200">
                  <QRCodeSVG value={payment.qr_payload} size={240} />
                </div>
              </div>

              <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 space-y-2">
                <p className="text-xs font-semibold text-amber-900">📲 วิธีจ่าย:</p>
                <ol className="text-xs text-amber-900 list-decimal pl-4 space-y-0.5">
                  <li>เปิด app ธนาคารใดก็ได้ → เมนู "สแกน QR"</li>
                  <li>สแกน QR ด้านบน → ตรวจชื่อ + จำนวน</li>
                  <li>ยืนยันโอน</li>
                  <li>กลับมาที่หน้านี้ → กด <strong>"อัปโหลด slip"</strong> ด้านล่าง</li>
                </ol>
              </div>

              <div className="flex items-center gap-2 px-3 py-2 bg-slate-100 rounded-lg text-xs">
                <span className="text-muted-foreground shrink-0">Ref:</span>
                <code className="flex-1 font-mono">{payment.reference}</code>
                <button onClick={copyRef} className="text-sky-600 hover:text-sky-800">
                  <Copy className="size-3.5" />
                </button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Upload slip */}
        {payment.status === "PENDING" && (
          <Card>
            <CardContent className="pt-5 pb-5 space-y-3">
              <p className="font-semibold text-foreground text-sm">📷 อัปโหลด slip การโอน</p>
              <label className="block">
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) handleUpload(file);
                  }}
                  disabled={uploading}
                />
                <div className={`border-2 border-dashed rounded-lg py-8 text-center cursor-pointer transition-colors ${
                  uploading ? "border-slate-200 bg-slate-50" : "border-pink-300 bg-pink-50 hover:bg-pink-100"
                }`}>
                  {uploading ? (
                    <>
                      <Loader2 className="size-8 mx-auto text-pink-500 animate-spin mb-2" />
                      <p className="text-sm text-muted-foreground">กำลัง upload + ตรวจสอบ slip...</p>
                    </>
                  ) : (
                    <>
                      <Upload className="size-8 mx-auto text-pink-600 mb-2" />
                      <p className="text-sm font-semibold text-pink-700">แตะเพื่อเลือกรูป slip</p>
                      <p className="text-[11px] text-muted-foreground mt-1">ไฟล์ JPG/PNG · ไม่เกิน 5 MB</p>
                    </>
                  )}
                </div>
              </label>
            </CardContent>
          </Card>
        )}

        {/* Verified — waiting confirm */}
        {(payment.status === "SLIP_UPLOADED" || payment.status === "VERIFIED") && (
          <Card>
            <CardContent className="pt-6 pb-6 text-center space-y-3">
              <Loader2 className="size-10 mx-auto text-purple-500 animate-spin" />
              <p className="font-semibold text-foreground">รอ admin ยืนยัน...</p>
              <p className="text-xs text-muted-foreground">
                {payment.status === "VERIFIED"
                  ? "ระบบตรวจสอบ slip อัตโนมัติเรียบร้อย รอ admin ยืนยันสุดท้าย"
                  : "รอ admin ตรวจสอบยอด/วันที่ใน slip"}
              </p>
            </CardContent>
          </Card>
        )}

        {/* Confirmed */}
        {payment.status === "CONFIRMED" && (
          <Card className="border-emerald-300 bg-emerald-50">
            <CardContent className="pt-6 pb-6 text-center space-y-3">
              <CheckCircle2 className="size-12 mx-auto text-emerald-600" />
              <p className="font-bold text-emerald-800 text-lg">ขอบคุณสำหรับการบริจาค!</p>
              <p className="text-sm text-emerald-700">
                ฿{Number(payment.amount).toLocaleString()} = {Number(payment.amount).toLocaleString()} TRPB
                <br />
                เข้ากระเป๋าระบบเรียบร้อยแล้ว
              </p>
              <Link href="/">
                <Button variant="outline" size="sm">กลับหน้าหลัก</Button>
              </Link>
            </CardContent>
          </Card>
        )}

        {/* Failed */}
        {payment.status === "FAILED" && (
          <Card className="border-red-300 bg-red-50">
            <CardContent className="pt-5 pb-5 space-y-2">
              <p className="font-semibold text-red-800">❌ ไม่ผ่านการยืนยัน</p>
              {payment.rejection_reason && (
                <p className="text-sm text-red-700">เหตุผล: {payment.rejection_reason}</p>
              )}
              <Link href="/donate">
                <Button size="sm" className="mt-2">ลองใหม่</Button>
              </Link>
            </CardContent>
          </Card>
        )}
      </main>
    </div>
  );
}
