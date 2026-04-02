"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Heart, CheckCircle, Wallet } from "lucide-react";
import { toast } from "sonner";

export default function DonatePage() {
  const [amount, setAmount] = useState("");
  const [purpose, setPurpose] = useState("");
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const supabase = createClient();

  async function handleDonate(e: React.FormEvent) {
    e.preventDefault();
    if (!amount || !purpose) return;
    setLoading(true);

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { toast.error("กรุณาเข้าสู่ระบบ"); setLoading(false); return; }

    const { error } = await supabase.from("donation_funds").insert({
      donor_id: user.id,
      amount: parseFloat(amount),
      purpose,
    });

    setLoading(false);
    if (error) { toast.error(error.message); }
    else { setSuccess(true); }
  }

  if (success) {
    return (
      <div className="max-w-md mx-auto mt-10">
        <Card className="text-center">
          <CardContent className="py-10 space-y-4">
            <CheckCircle className="size-16 mx-auto text-green-500" />
            <h2 className="text-xl font-bold text-foreground">บริจาคสำเร็จ!</h2>
            <p className="text-sm text-muted-foreground">ขอบคุณสำหรับการสนับสนุน</p>
            <Button onClick={() => { setSuccess(false); setAmount(""); setPurpose(""); }}>บริจาคอีกครั้ง</Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="max-w-lg mx-auto">
      <form onSubmit={handleDonate} className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-foreground flex items-center gap-2">
              <Heart className="size-5 text-pink-500" />บริจาคให้กองทุน
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label className="text-foreground">จำนวนเงิน (TRX)</Label>
              <Input type="number" placeholder="0" value={amount} onChange={(e) => setAmount(e.target.value)} min="1" required />
              <div className="flex gap-2">
                {[100, 500, 1000, 5000].map((v) => (
                  <Button key={v} type="button" size="sm" variant="outline" onClick={() => setAmount(String(v))}>{v}</Button>
                ))}
              </div>
            </div>
            <div className="space-y-2">
              <Label className="text-foreground">วัตถุประสงค์</Label>
              <Textarea placeholder="เช่น สนับสนุนอุปกรณ์ช่างไฟฟ้า, ทุนการศึกษา" value={purpose} onChange={(e) => setPurpose(e.target.value)} rows={3} required />
            </div>
            <div className="rounded-lg bg-blue-50 border border-blue-200 p-3 text-xs text-blue-800">
              <Wallet className="size-4 inline mr-1" />
              การบริจาคจะถูกบันทึกบน Blockchain — ตรวจสอบย้อนหลังได้ตลอด
            </div>
            <Button type="submit" className="w-full" size="lg" disabled={loading}>
              {loading ? "กำลังบันทึก..." : "ยืนยันการบริจาค"}
            </Button>
          </CardContent>
        </Card>
      </form>
    </div>
  );
}
