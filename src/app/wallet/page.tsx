"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Coins, History, Loader2, ArrowDownLeft, ArrowUpRight, ExternalLink, Lock,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { UserAvatar } from "@/components/user-avatar";

const TX_TYPE_LABELS: Record<string, { label: string; color: string }> = {
  MINT: { label: "ได้รับจากระบบ", color: "bg-blue-100 text-blue-800" },
  TRANSFER: { label: "โอน/รับ", color: "bg-slate-100 text-slate-700" },
  ESCROW_HOLD: { label: "กันใน Escrow", color: "bg-yellow-100 text-yellow-800" },
  ESCROW_RELEASE: { label: "ปล่อย Escrow", color: "bg-green-100 text-green-800" },
  ESCROW_REFUND: { label: "คืนจาก Escrow", color: "bg-orange-100 text-orange-800" },
  BURN: { label: "เผา", color: "bg-red-100 text-red-800" },
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyRow = any;

export default function WalletPage() {
  const router = useRouter();
  const [data, setData] = useState<AnyRow>(null);
  const [loading, setLoading] = useState(true);
  const [unauth, setUnauth] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const res = await fetch("/api/trpb/balance");
    if (res.status === 401) {
      setUnauth(true);
      setLoading(false);
      return;
    }
    if (res.ok) setData(await res.json());
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="size-8 animate-spin text-blue-500" />
      </div>
    );
  }

  if (unauth) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-muted px-4">
        <Card className="max-w-md w-full">
          <CardContent className="py-10 text-center space-y-3">
            <Lock className="size-10 mx-auto text-muted-foreground" />
            <p className="font-medium">กรุณาเข้าสู่ระบบ</p>
            <Button onClick={() => router.push("/login")}>เข้าสู่ระบบ</Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!data) return null;

  const balance = Number(data.balance?.balance ?? 0);
  const heldBalance = Number(data.balance?.hold_balance ?? 0);
  const transactions = data.recent_transactions ?? [];
  const ownId = data.balance?.user_id;

  return (
    <div className="min-h-screen bg-muted">
      <main className="max-w-3xl mx-auto px-4 py-8 space-y-6">
        <div className="flex items-center gap-3">
          <Coins className="size-8 text-yellow-600" />
          <div className="flex-1">
            <h1 className="text-2xl font-bold">Wallet — TRPB</h1>
            <p className="text-sm text-muted-foreground">ยอด TRPB และประวัติการเคลื่อนไหว</p>
          </div>
          <Button variant="outline" size="sm" onClick={() => router.back()}>
            ← กลับ
          </Button>
        </div>

        {/* Balance hero */}
        <Card className="border-yellow-200 bg-gradient-to-br from-yellow-50 to-amber-50">
          <CardContent className="py-6">
            <div className="text-xs text-muted-foreground">ยอดคงเหลือ</div>
            <div className="text-4xl font-bold text-amber-700 mt-1">
              {balance.toLocaleString()}
              <span className="text-base font-normal text-muted-foreground ml-2">TRPB</span>
            </div>
            {heldBalance > 0 && (
              <div className="text-sm text-yellow-700 mt-2">
                + {heldBalance.toLocaleString()} TRPB กันใน Escrow
              </div>
            )}
            <p className="text-[10px] text-muted-foreground mt-3">
              💡 TRPB คือเหรียญทดสอบบน TRON Nile testnet — ไม่สามารถแลกเป็นเงินจริงได้
            </p>
          </CardContent>
        </Card>

        {/* Recent transactions */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <History className="size-5 text-purple-600" />
              ประวัติการเคลื่อนไหว ({transactions.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            {transactions.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">
                ยังไม่มีธุรกรรม
              </p>
            ) : (
              <div className="space-y-1">
                {transactions.map((t: AnyRow) => {
                  const type = TX_TYPE_LABELS[t.tx_type] ?? { label: t.tx_type, color: "bg-gray-100" };
                  const isOutgoing = t.from_user === ownId;
                  const counterpartyId = isOutgoing ? t.to_user : t.from_user;
                  const isSystem = counterpartyId === "SYSTEM" || !counterpartyId;
                  return (
                    <div
                      key={t.id}
                      className="flex items-center justify-between py-2 px-3 rounded hover:bg-muted/50 text-sm border"
                    >
                      <div className="flex items-center gap-2 flex-1 min-w-0">
                        {/* Counterparty avatar + direction arrow stacked */}
                        <div className="relative shrink-0">
                          {isSystem ? (
                            <div className="size-8 rounded-full bg-gradient-to-br from-slate-300 to-slate-500 flex items-center justify-center text-white text-[10px] font-bold">
                              SYS
                            </div>
                          ) : (
                            <UserAvatar userId={counterpartyId} size="sm" />
                          )}
                          <span
                            className={cn(
                              "absolute -bottom-1 -right-1 size-4 rounded-full flex items-center justify-center ring-2 ring-card",
                              isOutgoing ? "bg-red-500" : "bg-emerald-500",
                            )}
                          >
                            {isOutgoing ? (
                              <ArrowUpRight className="size-2.5 text-white" />
                            ) : (
                              <ArrowDownLeft className="size-2.5 text-white" />
                            )}
                          </span>
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <Badge className={cn(type.color, "text-[10px]")}>{type.label}</Badge>
                            <span className="text-xs text-muted-foreground">
                              {new Date(t.created_at).toLocaleString("th-TH")}
                            </span>
                          </div>
                          {t.reason && (
                            <div className="text-xs text-muted-foreground mt-0.5 truncate">
                              {t.reason}
                            </div>
                          )}
                          {t.job_id && (
                            <Link
                              href={`/jobs/${t.job_id}`}
                              className="text-[10px] text-blue-600 hover:underline inline-flex items-center gap-0.5 mt-0.5"
                            >
                              <ExternalLink className="size-2.5" />
                              ดูงาน {String(t.job_id).slice(0, 8)}
                            </Link>
                          )}
                        </div>
                      </div>
                      <div className="text-right shrink-0 ml-2">
                        <div className={cn("font-semibold", isOutgoing ? "text-red-700" : "text-green-700")}>
                          {isOutgoing ? "−" : "+"} {Number(t.amount).toLocaleString()} TRPB
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Info card */}
        <Card className="bg-blue-50 border-blue-200">
          <CardContent className="py-4 text-sm space-y-1">
            <p className="font-medium text-blue-900">📌 การใช้งาน TRPB</p>
            <ul className="text-xs text-blue-800 list-disc list-inside space-y-0.5">
              <li><strong>นักศึกษา</strong>: รับ TRPB เมื่องานเสร็จและคณะทำงานปล่อย Escrow</li>
              <li><strong>ผู้ว่าจ้าง</strong>: ใช้ TRPB จ่ายค่าจ้างงาน — กันไว้ในระบบ Escrow ระหว่างทำงาน</li>
              <li><strong>คณะทำงานใต้ร่มฯ</strong>: รับโควต้าจาก admin → กระจายให้ผู้ว่าจ้าง + ปล่อย Escrow</li>
            </ul>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
