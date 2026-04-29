"use client";

import { useEffect, useState, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Coins, Loader2, Send, TrendingUp, Wallet, History } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

const TX_TYPE_LABELS: Record<string, { label: string; color: string }> = {
  MINT: { label: "จ่ายจาก Pool", color: "bg-blue-100 text-blue-800" },
  TRANSFER: { label: "โอน", color: "bg-slate-100 text-slate-700" },
  ESCROW_HOLD: { label: "กันไว้ใน Escrow", color: "bg-yellow-100 text-yellow-800" },
  ESCROW_RELEASE: { label: "ปล่อย Escrow", color: "bg-green-100 text-green-800" },
  ESCROW_REFUND: { label: "คืน Escrow", color: "bg-orange-100 text-orange-800" },
  BURN: { label: "เผา", color: "bg-red-100 text-red-800" },
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyRow = any;

export default function AdminTrpbPage() {
  const supabase = createClient();
  const [data, setData] = useState<AnyRow>(null);
  const [users, setUsers] = useState<AnyRow[]>([]);
  const [loading, setLoading] = useState(true);

  // Mint form state
  const [recipientId, setRecipientId] = useState("");
  const [amount, setAmount] = useState("");
  const [reason, setReason] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const res = await fetch("/api/admin/trpb");
    if (res.ok) {
      setData(await res.json());
    } else {
      const err = await res.json();
      toast.error(err.error || "โหลดข้อมูลไม่สำเร็จ");
    }

    // Load users for autocomplete
    const { data: u } = await supabase
      .from("skc_users")
      .select("id, name, email, role")
      .in("role", ["employer", "project_staff", "rmutl_staff", "teacher", "student"])
      .order("name");
    setUsers(u ?? []);
    setLoading(false);
  }, [supabase]);

  useEffect(() => { load(); }, [load]);

  async function handleMint(e: React.FormEvent) {
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
    const res = await fetch("/api/admin/trpb/mint", {
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
      toast.error(result.error || "จ่ายไม่สำเร็จ", { duration: 8000 });
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

  const pool = data.pool;
  const balances = data.balances ?? [];
  const transactions = data.recent_transactions ?? [];

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Coins className="size-8 text-yellow-600" />
        <div>
          <h1 className="text-2xl font-bold">TRPB Off-chain Ledger</h1>
          <p className="text-sm text-muted-foreground">จัดการ TRPB pool — จ่ายเหรียญให้ผู้ใช้สำหรับทดสอบระบบ</p>
        </div>
      </div>

      {/* Pool stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card>
          <CardContent className="py-4">
            <div className="text-xs text-muted-foreground">SYSTEM Pool คงเหลือ</div>
            <div className="text-2xl font-bold text-blue-600 mt-1">
              {pool.pool_balance.toLocaleString()}
            </div>
            <div className="text-[10px] text-muted-foreground">TRPB</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="py-4">
            <div className="text-xs text-muted-foreground">แจกจ่ายแล้ว</div>
            <div className="text-2xl font-bold text-green-600 mt-1">
              {pool.distributed.toLocaleString()}
            </div>
            <div className="text-[10px] text-muted-foreground">TRPB ในมือผู้ใช้</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="py-4">
            <div className="text-xs text-muted-foreground">กันใน Escrow</div>
            <div className="text-2xl font-bold text-yellow-600 mt-1">
              {pool.held.toLocaleString()}
            </div>
            <div className="text-[10px] text-muted-foreground">TRPB ค้างในงาน</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="py-4">
            <div className="text-xs text-muted-foreground">Total Supply</div>
            <div className="text-2xl font-bold text-foreground mt-1">
              {pool.total_supply.toLocaleString()}
            </div>
            <div className="text-[10px] text-muted-foreground">TRPB ทั้งหมด</div>
          </CardContent>
        </Card>
      </div>

      {/* Mint form */}
      <Card className="border-blue-200">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Send className="size-5 text-blue-600" />
            จ่าย TRPB จาก Pool
          </CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleMint} className="grid md:grid-cols-3 gap-3">
            <div className="space-y-2 md:col-span-1">
              <Label>ผู้รับ</Label>
              <Select value={recipientId} onValueChange={(v) => setRecipientId(v ?? "")}>
                <SelectTrigger>
                  <SelectValue placeholder="เลือกผู้ใช้..." />
                </SelectTrigger>
                <SelectContent className="max-h-72">
                  {users.map((u) => (
                    <SelectItem key={u.id} value={u.id}>
                      {u.name} ({u.role}) — {u.email}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>จำนวน TRPB</Label>
              <Input
                type="number"
                placeholder="เช่น 1000"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                min={1}
                step={0.01}
              />
            </div>
            <div className="space-y-2">
              <Label>เหตุผล</Label>
              <Input
                placeholder="เช่น ทดสอบระบบ"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
              />
            </div>
            <div className="md:col-span-3 flex justify-end">
              <Button type="submit" disabled={submitting} className="bg-blue-600 hover:bg-blue-700">
                {submitting ? (
                  <><Loader2 className="size-4 mr-1 animate-spin" />กำลังจ่าย...</>
                ) : (
                  <><Send className="size-4 mr-1" />จ่ายจาก Pool</>
                )}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      {/* Top balances */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Wallet className="size-5 text-green-600" />
            ยอดคงเหลือผู้ใช้ (top 20)
          </CardTitle>
        </CardHeader>
        <CardContent>
          {balances.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-6">ยังไม่มีผู้ใช้ที่มี TRPB — เริ่มจ่ายจาก pool ด้านบน</p>
          ) : (
            <div className="space-y-1">
              {balances.map((b: AnyRow) => (
                <div key={b.user_id} className="flex items-center justify-between py-2 px-3 rounded hover:bg-muted/50 text-sm border">
                  <div className="flex-1 min-w-0">
                    <div className="font-medium">{b.user?.name ?? b.user_id}</div>
                    <div className="text-xs text-muted-foreground">{b.user?.email} · {b.user?.role}</div>
                  </div>
                  <div className="text-right shrink-0">
                    <div className="font-semibold text-green-700">
                      {b.balance.toLocaleString()} TRPB
                    </div>
                    {b.hold_balance > 0 && (
                      <div className="text-xs text-yellow-700">
                        + {b.hold_balance.toLocaleString()} held
                      </div>
                    )}
                  </div>
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
            ธุรกรรมล่าสุด (30)
          </CardTitle>
        </CardHeader>
        <CardContent>
          {transactions.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-6">ยังไม่มีธุรกรรม</p>
          ) : (
            <div className="space-y-1 max-h-96 overflow-y-auto">
              {transactions.map((t: AnyRow) => {
                const type = TX_TYPE_LABELS[t.tx_type] ?? { label: t.tx_type, color: "bg-gray-100" };
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
                      <div className="font-semibold text-green-700">
                        {Number(t.amount).toLocaleString()} TRPB
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

      <Card className="bg-amber-50 border-amber-200">
        <CardContent className="py-4 text-sm space-y-2">
          <div className="flex items-center gap-2 font-medium text-amber-900">
            <TrendingUp className="size-4" />
            หมายเหตุระบบ
          </div>
          <ul className="text-xs text-amber-800 space-y-1 list-disc list-inside">
            <li>ระบบใช้ <strong>off-chain ledger</strong> เป็นหลัก — ไม่เรียก TRON Nile อัตโนมัติ</li>
            <li>SYSTEM Pool เริ่มต้น 1,000,000 TRPB — admin จ่ายให้ผู้ใช้ได้ตามต้องการ</li>
            <li>เมื่อ release escrow งาน — ระบบจะ auto top-up ผู้จ้างจาก SYSTEM ถ้าไม่มี balance พอ (test mode)</li>
            <li>Nile Tronscan เป็น <em>mirror link เท่านั้น</em> — admin sync ภายหลังถ้าต้องการ</li>
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}
