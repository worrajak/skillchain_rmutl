"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Heart, ArrowLeft, Loader2, Sparkles } from "lucide-react";
import { toast } from "sonner";

const QUICK_AMOUNTS = [100, 300, 500, 1000, 2000];

export default function DonatePage() {
  const router = useRouter();
  const [amount, setAmount] = useState<number | "">("");
  const [name, setName] = useState("");
  const [note, setNote] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit() {
    if (!amount || Number(amount) < 1) {
      toast.error("กรุณาระบุจำนวนเงิน (ขั้นต่ำ 1 บาท)");
      return;
    }
    setLoading(true);
    const res = await fetch("/api/payments", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        amount: Number(amount),
        purpose: "donation",
        payer_name: name || null,
        payer_note: note || null,
      }),
    });
    const data = await res.json();
    setLoading(false);

    if (!res.ok) {
      toast.error(data.error || "สร้าง QR ไม่สำเร็จ");
      return;
    }
    router.push(`/donate/${data.id}`);
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-pink-50 to-rose-50">
      <header className="bg-gradient-to-r from-pink-500 to-rose-600 text-white">
        <div className="max-w-3xl mx-auto px-4 py-4 flex items-center justify-between">
          <Link href="/">
            <Button variant="ghost" size="sm" className="text-white/80 hover:text-white hover:bg-white/10 -ml-2">
              <ArrowLeft className="size-4 mr-1" />กลับหน้าหลัก
            </Button>
          </Link>
          <div className="flex items-center gap-2">
            <Heart className="size-5 fill-pink-200 text-pink-200" />
            <span className="font-semibold">ร่วมบริจาคสนับสนุน นศ. ใต้ร่มฯ</span>
          </div>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-8 space-y-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Sparkles className="size-5 text-amber-500" />
              ระบุจำนวนเงิน
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-5">
            {/* Quick amounts */}
            <div>
              <p className="text-xs text-muted-foreground mb-2">เลือกจำนวนด่วน (บาท)</p>
              <div className="grid grid-cols-5 gap-2">
                {QUICK_AMOUNTS.map((a) => (
                  <button
                    key={a}
                    onClick={() => setAmount(a)}
                    className={`py-2.5 rounded-lg border-2 text-sm font-semibold transition-all ${
                      amount === a
                        ? "border-pink-500 bg-pink-50 text-pink-700"
                        : "border-slate-200 hover:border-pink-300"
                    }`}
                  >
                    {a.toLocaleString()}
                  </button>
                ))}
              </div>
            </div>

            {/* Custom amount */}
            <div>
              <label className="text-xs text-muted-foreground mb-1.5 block">หรือกรอกเอง</label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">฿</span>
                <Input
                  type="number"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value ? Number(e.target.value) : "")}
                  placeholder="เช่น 200"
                  className="pl-7 text-lg font-semibold"
                  min={1}
                  max={100000}
                />
              </div>
            </div>

            <div className="border-t pt-4 space-y-3">
              <div>
                <label className="text-xs text-muted-foreground mb-1.5 block">ชื่อ (จะแสดงในรายการประกาศ — ปล่อยว่าง = ไม่ระบุชื่อ)</label>
                <Input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="เช่น คุณวรจักร"
                />
              </div>

              <div>
                <label className="text-xs text-muted-foreground mb-1.5 block">ข้อความฝาก (ไม่บังคับ)</label>
                <Textarea
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder="เช่น สู้ๆ น้องๆ ช่าง"
                  rows={2}
                />
              </div>
            </div>

            <Button
              onClick={handleSubmit}
              disabled={loading || !amount}
              className="w-full bg-pink-500 hover:bg-pink-600 h-12 text-base"
            >
              {loading ? (
                <><Loader2 className="size-5 mr-2 animate-spin" />กำลังสร้าง QR...</>
              ) : (
                <><Heart className="size-5 mr-2" />สร้าง QR สำหรับบริจาค</>
              )}
            </Button>

            <p className="text-[11px] text-center text-muted-foreground">
              คุณจะเห็น QR PromptPay สำหรับสแกนจ่ายผ่าน Mobile Banking app ใดก็ได้ในไทย
            </p>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
