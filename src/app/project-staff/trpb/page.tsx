"use client";

import { useEffect, useState, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Coins, Loader2, Send, Wallet, History, AlertCircle, ArrowDownToLine,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

const TX_TYPE_LABELS: Record<string, { label: string; color: string }> = {
  MINT: { label: "รับจาก Pool", color: "bg-blue-100 text-blue-800" },
  TRANSFER: { label: "โอน", color: "bg-slate-100 text-slate-700" },
  ESCROW_HOLD: { label: "กันใน Escrow", color: "bg-yellow-100 text-yellow-800" },
  ESCROW_RELEASE: { label: "ปล่อย Escrow", color: "bg-green-100 text-green-800" },
  ESCROW_REFUND: { label: "คืน Escrow", color: "bg-orange-100 text-orange-800" },
  BURN: { label: "เผา", color: "bg-red-100 text-red-800" },
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyRow = any;

export default function StaffTrpbPage() {
  const [data, setData] = useState<AnyRow>(null);
  const [loading, setLoading] = useState(true);

  const [recipientId, setRecipientId] = useState("");
  const [amount, setAmount] = useState("");
  const [reason, setReason] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const res = await fetch("/api/trpb/staff-overview");
    if (res.ok) setData(await res.json());
    else {
      const err = await res.json();
      toast.error(err.error || "โหลดข้อมูลไม่สำเร็จ");
    }
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  async function handleTransfer(e: React.FormEvent) {
    e.preventDefault();
    if (!recipientId || !amount) {
      toast.error("กรุณาเลือกผู้รับ + ระบุจำนวน");
      return;
    }
    const amt = Number(amount);
    if (!Number.isFinite(amt) || amt <= 0) {
      toast.error("จำนวนต้องเป็นตัวเลข > 0");
      return;
    }

    setSubmitting(true);
    const res = await fetch("/api/trpb/transfer", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ to_user_id: recipientId, amount: amt, reason }),
    });
    const result = await res.json();
    setSubmitting(false);

    if (res.ok) {
      toast.success(result.message);
      setRecipientId("");
      setAmount("");
      setReason("");
      load();
    } else {
      toast.error(result.error || "โอนไม่สำเร็จ", { duration: 8000 });
    }
  }

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <Loader2 className="size-8 animate-spin text-blue-500" />
      </div>
    );
  }

  if (!data) return null;

  const me = data.me;
  const employers = data.employers ?? [];
  const transactions = data.recent_transactions ?? [];
  const noBalance = me.balance <= 0;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Coins className="size-8 text-yellow-600" />
        <div>
          <h1 className="text-2xl font-bold">จ่าย TRPB ให้ผู้ว่าจ้าง</h1>
          <p className="text-sm text-muted-foreground">
            กระจายโควต้าที่ admin มอบให้ → ผู้ว่าจ้างใช้สำหรับจ้างงาน
          </p>
        </div>
      </div>

      {/* My balance */}
      <Card className={cn(noBalance ? "border-orange-300 bg-orange-50/40" : "border-green-300 bg-green-50/40")}>
        <CardContent className="py-5 flex items-center justify-between gap-4 flex-wrap">
          <div>
            <div className="text-xs text-muted-foreground">ยอดของคุณ ({me.name})</div>
            <div className={cn("text-3xl font-bold mt-1", noBalance ? "text-orange-600" : "text-green-700")}>
              {me.balance.toLocaleString()} TRPB
            </div>
            {me.hold_balance > 0 && (
              <div className="text-xs text-yellow-700 mt-1">
                + {me.hold_balance.toLocaleString()} held in escrow
              </div>
            )}
          </div>
          {noBalance && (
            <div className="text-sm text-orange-800 bg-orange-100 px-3 py-2 rounded flex items-center gap-2 max-w-md">
              <AlertCircle className="size-4 shrink-0" />
              <span>คุณยังไม่มี TRPB — ขอ admin จ่ายให้ก่อนผ่าน <strong>/admin/trpb</strong></span>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Transfer form */}
      <Card className={cn(noBalance && "opacity-60 pointer-events-none")}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Send className="size-5 text-blue-600" />
            โอน TRPB ให้ผู้ว่าจ้าง
          </CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleTransfer} className="grid md:grid-cols-3 gap-3">
            <div className="space-y-2 md:col-span-1">
              <Label>ผู้ว่าจ้าง</Label>
              <Select value={recipientId} onValueChange={(v) => setRecipientId(v ?? "")}>
                <SelectTrigger>
                  <SelectValue placeholder="เลือกผู้ว่าจ้าง..." />
                </SelectTrigger>
                <SelectContent className="max-h-72">
                  {employers.map((e: AnyRow) => (
                    <SelectItem key={e.id} value={e.id}>
                      {e.name} {e.organization ? `(${e.organization})` : ""} — มี {e.balance.toLocaleString()} TRPB
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>จำนวน TRPB</Label>
              <Input
                type="number"
                placeholder="เช่น 5000"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                min={1}
                max={me.balance}
                step={0.01}
              />
              <p className="text-[10px] text-muted-foreground">
                สูงสุด {me.balance.toLocaleString()} TRPB
              </p>
            </div>
            <div className="space-y-2">
              <Label>เหตุผล / โครงการ</Label>
              <Input
                placeholder="เช่น โควต้าโครงการล้านนาเฟส 1"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
              />
            </div>
            <div className="md:col-span-3 flex justify-end">
              <Button
                type="submit"
                disabled={submitting || noBalance}
                className="bg-blue-600 hover:bg-blue-700"
              >
                {submitting ? (
                  <><Loader2 className="size-4 mr-1 animate-spin" />กำลังโอน...</>
                ) : (
                  <><Send className="size-4 mr-1" />โอน TRPB</>
                )}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      {/* Employers + balances */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Wallet className="size-5 text-green-600" />
            ผู้ว่าจ้างทั้งหมด ({employers.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {employers.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-6">ยังไม่มีผู้ว่าจ้างในระบบ</p>
          ) : (
            <div className="space-y-1 max-h-96 overflow-y-auto">
              {employers.map((e: AnyRow) => (
                <div
                  key={e.id}
                  className="flex items-center justify-between py-2 px-3 rounded hover:bg-muted/50 text-sm border"
                >
                  <div className="flex-1 min-w-0">
                    <div className="font-medium">{e.name}</div>
                    <div className="text-xs text-muted-foreground">
                      {e.email}
                      {e.organization && ` · ${e.organization}`}
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <div className={cn("font-semibold", e.balance > 0 ? "text-green-700" : "text-muted-foreground")}>
                      {e.balance.toLocaleString()} TRPB
                    </div>
                    {e.hold_balance > 0 && (
                      <div className="text-xs text-yellow-700">
                        + {e.hold_balance.toLocaleString()} held
                      </div>
                    )}
                  </div>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="ml-2 shrink-0"
                    onClick={() => {
                      setRecipientId(e.id);
                      window.scrollTo({ top: 0, behavior: "smooth" });
                    }}
                    disabled={noBalance}
                  >
                    <ArrowDownToLine className="size-3 mr-1" />
                    โอน
                  </Button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Recent transactions */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <History className="size-5 text-purple-600" />
            ธุรกรรมล่าสุด ({transactions.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {transactions.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-6">ยังไม่มีธุรกรรม</p>
          ) : (
            <div className="space-y-1 max-h-96 overflow-y-auto">
              {transactions.map((t: AnyRow) => {
                const type = TX_TYPE_LABELS[t.tx_type] ?? { label: t.tx_type, color: "bg-gray-100" };
                const isOutgoing = t.from_user === me.user_id || (t.from_name && !t.to_name?.includes(me.name));
                return (
                  <div key={t.id} className="flex items-center justify-between py-2 px-3 rounded hover:bg-muted/50 text-xs border">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <Badge className={cn(type.color, "text-[10px]")}>{type.label}</Badge>
                        <span className="text-foreground">
                          {t.from_name ?? "-"} → <strong>{t.to_name ?? "-"}</strong>
                        </span>
                      </div>
                      {t.reason && <div className="text-muted-foreground mt-0.5 truncate">{t.reason}</div>}
                    </div>
                    <div className="text-right shrink-0 ml-2">
                      <div className={cn("font-semibold", isOutgoing ? "text-red-700" : "text-green-700")}>
                        {isOutgoing ? "−" : "+"} {Number(t.amount).toLocaleString()} TRPB
                      </div>
                      <div className="text-[10px] text-muted-foreground">
                        {new Date(t.created_at).toLocaleString("th-TH")}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="bg-blue-50 border-blue-200">
        <CardContent className="py-4 text-sm space-y-1">
          <p className="font-medium text-blue-900">📌 ขั้นตอน flow ตามที่ตกลง</p>
          <ol className="text-xs text-blue-800 list-decimal list-inside space-y-0.5">
            <li>Admin → จ่าย TRPB ให้คณะทำงานใต้ร่ม (ผ่าน <code>/admin/trpb</code>)</li>
            <li>คณะทำงานใต้ร่ม → โอน TRPB ให้ผู้ว่าจ้างที่ขอใช้สิทธิ์ (หน้านี้)</li>
            <li>ผู้ว่าจ้าง → ใช้ TRPB จ่ายค่าจ้างงานผ่าน escrow</li>
            <li>นศ. → ได้รับ TRPB เมื่อ staff ยืนยันงานเสร็จและปล่อย escrow</li>
          </ol>
        </CardContent>
      </Card>
    </div>
  );
}
