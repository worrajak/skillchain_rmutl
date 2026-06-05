"use client";

import { useEffect, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  Heart, Loader2, CheckCircle2, XCircle, ExternalLink, Eye, Coins,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { createClient } from "@/lib/supabase/client";

interface Payment {
  id: string;
  amount: number;
  reference: string;
  payer_id: string | null;
  payer_name: string | null;
  payer_note: string | null;
  purpose: string;
  status: string;
  slip_url: string | null;
  verify_result: Record<string, unknown> | null;
  trpb_minted: number | null;
  trpb_tx_id: string | null;
  rejection_reason: string | null;
  created_at: string;
  confirmed_at: string | null;
  payer?: { name: string | null; email: string | null } | null;
}

const STATUS_INFO: Record<string, { label: string; color: string; emoji: string }> = {
  PENDING: { label: "รอจ่าย", color: "bg-amber-100 text-amber-800 border-amber-300", emoji: "⏳" },
  SLIP_UPLOADED: { label: "ส่ง slip · รอ admin", color: "bg-blue-100 text-blue-800 border-blue-300", emoji: "📥" },
  VERIFIED: { label: "ตรวจผ่าน · รอ confirm", color: "bg-purple-100 text-purple-800 border-purple-300", emoji: "✓" },
  CONFIRMED: { label: "ยืนยันแล้ว", color: "bg-emerald-100 text-emerald-800 border-emerald-300", emoji: "✅" },
  FAILED: { label: "ปฏิเสธ", color: "bg-red-100 text-red-800 border-red-300", emoji: "❌" },
  EXPIRED: { label: "หมดอายุ", color: "bg-slate-100 text-slate-700 border-slate-300", emoji: "⏰" },
};

const FILTERS = [
  { key: "actionable", label: "🔥 ต้องดู", statuses: ["SLIP_UPLOADED", "VERIFIED"] },
  { key: "all", label: "ทั้งหมด", statuses: [] },
  { key: "pending", label: "⏳ รอจ่าย", statuses: ["PENDING"] },
  { key: "confirmed", label: "✅ ยืนยันแล้ว", statuses: ["CONFIRMED"] },
  { key: "failed", label: "❌ ปฏิเสธ/หมดอายุ", statuses: ["FAILED", "EXPIRED"] },
];

export default function AdminPaymentsPage() {
  const [payments, setPayments] = useState<Payment[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("actionable");
  const [busy, setBusy] = useState<string | null>(null);
  const [rejectPayment, setRejectPayment] = useState<Payment | null>(null);
  const [rejectReason, setRejectReason] = useState("");
  const [previewSlip, setPreviewSlip] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    const res = await fetch("/api/payments");
    const data = await res.json();
    setPayments(data.payments ?? []);
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  // Generate signed URL for slip preview
  async function previewSlipFor(payment: Payment) {
    if (!payment.slip_url) return;
    const supabase = createClient();
    const { data } = await supabase.storage
      .from("payment-slips")
      .createSignedUrl(payment.slip_url, 60 * 10);
    if (data?.signedUrl) setPreviewSlip(data.signedUrl);
  }

  async function handleConfirm(payment: Payment) {
    if (!window.confirm(`ยืนยันการบริจาค ${payment.amount} THB และ mint TRPB?`)) return;
    setBusy(payment.id);
    const res = await fetch(`/api/payments/${payment.id}/confirm`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "CONFIRM" }),
    });
    const data = await res.json();
    setBusy(null);
    if (!res.ok) {
      toast.error(data.error || "Confirm failed");
      return;
    }
    toast.success("✅ ยืนยันสำเร็จ");
    load();
  }

  async function reject() {
    if (!rejectPayment) return;
    setBusy(rejectPayment.id);
    const res = await fetch(`/api/payments/${rejectPayment.id}/confirm`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "REJECT", reason: rejectReason || "Admin rejected" }),
    });
    setBusy(null);
    if (!res.ok) {
      const data = await res.json();
      toast.error(data.error || "Reject failed");
      return;
    }
    toast.success("ปฏิเสธแล้ว");
    setRejectPayment(null);
    setRejectReason("");
    load();
  }

  const filtered = (() => {
    const target = FILTERS.find((f) => f.key === filter);
    if (!target || target.statuses.length === 0) return payments;
    return payments.filter((p) => target.statuses.includes(p.status));
  })();

  const counts = (() => {
    const m: Record<string, number> = {};
    for (const f of FILTERS) {
      m[f.key] = f.statuses.length === 0
        ? payments.length
        : payments.filter((p) => f.statuses.includes(p.status)).length;
    }
    return m;
  })();

  if (loading) {
    return <div className="flex justify-center py-12"><Loader2 className="size-8 animate-spin text-pink-500" /></div>;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
          <Heart className="size-6 text-pink-500" />
          การบริจาค + Top-up
        </h1>
        <p className="text-sm text-muted-foreground">
          {payments.length} รายการ
        </p>
      </div>

      {/* Filter chips */}
      <div className="flex flex-wrap gap-2">
        {FILTERS.map((f) => {
          const active = filter === f.key;
          const count = counts[f.key] ?? 0;
          const hot = f.key === "actionable" && count > 0;
          return (
            <button
              key={f.key}
              onClick={() => setFilter(f.key)}
              className={cn(
                "px-3 py-1.5 rounded-full text-xs font-medium border transition-colors",
                active
                  ? "bg-pink-600 text-white border-pink-600"
                  : hot
                    ? "bg-amber-50 text-amber-800 border-amber-300"
                    : "bg-white text-foreground border-gray-200 hover:border-pink-300"
              )}
            >
              {f.label} {count > 0 && <span className={cn("ml-1", active ? "opacity-80" : "text-muted-foreground")}>({count})</span>}
            </button>
          );
        })}
      </div>

      {/* List */}
      {filtered.length === 0 ? (
        <Card><CardContent className="py-12 text-center">
          <Heart className="size-12 mx-auto text-muted-foreground/40 mb-3" />
          <p className="text-foreground font-medium">ไม่มีรายการ</p>
        </CardContent></Card>
      ) : (
        <div className="space-y-2">
          {filtered.map((p) => {
            const s = STATUS_INFO[p.status] ?? STATUS_INFO.PENDING;
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const verifyAmount = (p.verify_result as any)?.data?.amount?.amount ?? (p.verify_result as any)?.data?.amount;
            const amountMatches = verifyAmount === Number(p.amount);

            return (
              <Card key={p.id} className="overflow-hidden">
                <CardContent className="p-4 space-y-2">
                  <div className="flex items-start justify-between gap-3 flex-wrap">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-bold text-lg text-pink-700">฿{Number(p.amount).toLocaleString()}</span>
                        <Badge className={cn("border", s.color)}>{s.emoji} {s.label}</Badge>
                        <Badge variant="outline" className="text-[10px]">{p.purpose}</Badge>
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">
                        {p.payer_name ?? p.payer?.name ?? "ไม่ระบุชื่อ"} {p.payer?.email && <>· {p.payer.email}</>}
                      </p>
                      {p.payer_note && (
                        <p className="text-xs italic text-slate-600 mt-1 line-clamp-1">&ldquo;{p.payer_note}&rdquo;</p>
                      )}
                      <p className="text-[10px] text-muted-foreground mt-1 font-mono">{p.reference}</p>
                    </div>
                    <div className="text-right text-[10px] text-muted-foreground">
                      {new Date(p.created_at).toLocaleString("th-TH", { dateStyle: "short", timeStyle: "short" })}
                    </div>
                  </div>

                  {/* Slip + verify info */}
                  {p.slip_url && (
                    <div className="border-t pt-2 flex items-center gap-2 flex-wrap">
                      <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => previewSlipFor(p)}>
                        <Eye className="size-3 mr-1" />ดู slip
                      </Button>
                      {p.verify_result && (
                        <span className={cn(
                          "inline-flex items-center gap-1 text-[11px] rounded px-2 py-0.5",
                          amountMatches ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700"
                        )}>
                          easyslip: ฿{verifyAmount?.toLocaleString() ?? "?"} {amountMatches ? "✓ ตรง" : "⚠️ ไม่ตรง"}
                        </span>
                      )}
                    </div>
                  )}

                  {/* TRPB minted info */}
                  {p.trpb_minted && (
                    <div className="border-t pt-2 flex items-center gap-2 text-xs">
                      <Coins className="size-3.5 text-amber-500" />
                      <span>Minted <strong>{Number(p.trpb_minted).toLocaleString()} TRPB</strong></span>
                      {p.trpb_tx_id && (
                        <code className="text-[10px] text-muted-foreground">tx: {p.trpb_tx_id.slice(0, 12)}…</code>
                      )}
                    </div>
                  )}

                  {/* Actions */}
                  {(p.status === "SLIP_UPLOADED" || p.status === "VERIFIED") && (
                    <div className="border-t pt-2 flex gap-2">
                      <Button
                        size="sm"
                        onClick={() => handleConfirm(p)}
                        disabled={busy === p.id}
                        className="bg-emerald-500 hover:bg-emerald-600"
                      >
                        {busy === p.id ? <Loader2 className="size-4 animate-spin mr-1" /> : <CheckCircle2 className="size-4 mr-1" />}
                        ยืนยัน + Mint TRPB
                      </Button>
                      <Button size="sm" variant="outline" className="text-red-600" onClick={() => setRejectPayment(p)}>
                        <XCircle className="size-4 mr-1" />ปฏิเสธ
                      </Button>
                    </div>
                  )}

                  {p.status === "FAILED" && p.rejection_reason && (
                    <p className="text-xs text-red-700 border-t pt-2">เหตุผล: {p.rejection_reason}</p>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Reject dialog */}
      <Dialog open={!!rejectPayment} onOpenChange={(o) => !o && setRejectPayment(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>ปฏิเสธ payment</DialogTitle></DialogHeader>
          {rejectPayment && (
            <div className="space-y-3">
              <p className="text-sm">฿{Number(rejectPayment.amount).toLocaleString()} · {rejectPayment.reference}</p>
              <Textarea
                placeholder="เหตุผล (เช่น ยอดไม่ตรง · slip ปลอม · วันที่ผิด)"
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                rows={3}
              />
              <Button onClick={reject} disabled={busy === rejectPayment.id} variant="outline" className="text-red-600 w-full">
                <XCircle className="size-4 mr-1" />ปฏิเสธ
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Slip preview */}
      <Dialog open={!!previewSlip} onOpenChange={(o) => !o && setPreviewSlip(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader><DialogTitle>Slip การโอน</DialogTitle></DialogHeader>
          {previewSlip && (
            <div className="space-y-2">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={previewSlip} alt="Slip" className="w-full rounded border" />
              <a href={previewSlip} target="_blank" rel="noopener" className="text-xs text-sky-600 hover:underline inline-flex items-center gap-1">
                <ExternalLink className="size-3" />เปิดในแท็บใหม่
              </a>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
