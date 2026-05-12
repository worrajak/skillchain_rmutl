"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import {
  FileText, Plus, ChevronRight, Loader2, CheckCircle2, Clock, XCircle, Archive,
} from "lucide-react";

interface Batch {
  id: string;
  batch_no: string;
  title: string;
  period_start: string;
  period_end: string;
  status: string;
  total_jobs: number;
  total_students: number;
  total_amount: number;
  approved_at: string | null;
  created_at: string;
  creator?: { name: string };
  approver?: { name: string } | null;
}

interface CandidateJob {
  id: string;
  title: string;
  type: string;
  job_category: string;
  pay_amount: number;
  required_workers: number;
  employer?: { name: string };
}

const STATUS_LABEL: Record<string, { label: string; color: string; icon: typeof Clock }> = {
  PENDING: { label: "กำลังจัดทำ", color: "bg-slate-100 text-slate-700", icon: Clock },
  COMPILED: { label: "รอลายเซ็น", color: "bg-amber-100 text-amber-800", icon: FileText },
  APPROVED: { label: "อนุมัติแล้ว", color: "bg-emerald-100 text-emerald-800", icon: CheckCircle2 },
  REJECTED: { label: "ถูกปฏิเสธ", color: "bg-red-100 text-red-700", icon: XCircle },
  CLOSED: { label: "ปิดรอบ", color: "bg-gray-200 text-gray-700", icon: Archive },
};

const TYPE_LABEL: Record<string, string> = {
  PAID: "งานจ้าง",
  VOLUNTEER: "จิตอาสา",
  TRAINING: "ฝึกทักษะ",
  EXEMPTED: "ยกเว้น",
};

const CATEGORY_LABEL: Record<string, string> = {
  electrical: "ไฟฟ้า",
  hvac: "แอร์",
  automotive: "ยานยนต์",
  general: "ทั่วไป",
};

function today(): string {
  return new Date().toISOString().slice(0, 10);
}
function daysAgo(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString().slice(0, 10);
}

export default function GovBatchesPage() {
  const router = useRouter();
  const [batches, setBatches] = useState<Batch[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);

  // Create modal state
  const [showCreate, setShowCreate] = useState(false);
  const [periodStart, setPeriodStart] = useState(daysAgo(3));
  const [periodEnd, setPeriodEnd] = useState(today());
  const [candidates, setCandidates] = useState<CandidateJob[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [loadingCandidates, setLoadingCandidates] = useState(false);

  async function loadBatches() {
    setLoading(true);
    const res = await fetch("/api/gov/batches");
    const data = await res.json();
    if (res.ok) setBatches(data.batches ?? []);
    setLoading(false);
  }

  async function loadCandidates() {
    setLoadingCandidates(true);
    const url = `/api/gov/batches?candidates=1&start=${periodStart}&end=${periodEnd}`;
    const res = await fetch(url);
    const data = await res.json();
    if (res.ok) {
      setCandidates(data.jobs ?? []);
      // Auto-select all by default
      setSelectedIds(new Set((data.jobs ?? []).map((j: CandidateJob) => j.id)));
    } else {
      toast.error(data.error || "โหลดงานไม่สำเร็จ");
    }
    setLoadingCandidates(false);
  }

  useEffect(() => {
    loadBatches();
  }, []);

  useEffect(() => {
    if (showCreate) loadCandidates();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showCreate, periodStart, periodEnd]);

  async function handleCreate() {
    if (selectedIds.size === 0) {
      toast.error("กรุณาเลือกงานอย่างน้อย 1 งาน");
      return;
    }
    setCreating(true);
    const res = await fetch("/api/gov/batches", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        period_start: periodStart,
        period_end: periodEnd,
        job_ids: Array.from(selectedIds),
      }),
    });
    const data = await res.json();
    setCreating(false);
    if (!res.ok) {
      toast.error(data.error || "สร้าง batch ไม่สำเร็จ");
      return;
    }
    toast.success(`✅ สร้างรอบ ${data.batch.batch_no} สำเร็จ`);
    setShowCreate(false);
    router.push(`/project-staff/gov-batches/${data.batch.id}`);
  }

  const totalAmount = candidates
    .filter((j) => selectedIds.has(j.id))
    .reduce((s, j) => s + Number(j.pay_amount ?? 0), 0);
  const totalStudents = candidates
    .filter((j) => selectedIds.has(j.id))
    .reduce((s, j) => s + (j.required_workers ?? 1), 0);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold flex items-center gap-2">
            <FileText className="size-5 text-amber-600" />
            เอกสารขออนุมัติ (รอบ)
          </h1>
          <p className="text-xs text-muted-foreground mt-1">
            รวบรวมงานในช่วง 2-3 วัน → ออกเอกสารขออนุมัติฉบับเดียว
          </p>
        </div>
        <Button onClick={() => setShowCreate(true)} className="bg-amber-500 hover:bg-amber-600 text-white">
          <Plus className="size-4 mr-1" />
          สร้างรอบใหม่
        </Button>
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="size-6 animate-spin text-amber-500" />
        </div>
      ) : batches.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            <Archive className="size-10 mx-auto mb-2 opacity-50" />
            <p>ยังไม่มีรอบอนุมัติ</p>
            <p className="text-xs mt-1">กดปุ่ม "สร้างรอบใหม่" เพื่อเริ่มต้น</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {batches.map((b) => {
            const status = STATUS_LABEL[b.status] ?? STATUS_LABEL.PENDING;
            const Icon = status.icon;
            return (
              <Link key={b.id} href={`/project-staff/gov-batches/${b.id}`}>
                <Card className="hover:ring-2 hover:ring-amber-200 transition-all cursor-pointer">
                  <CardContent className="py-4 flex items-center gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-mono text-xs font-bold text-amber-700">{b.batch_no}</span>
                        <Badge className={status.color}>
                          <Icon className="size-3 mr-1" />
                          {status.label}
                        </Badge>
                      </div>
                      <p className="font-medium text-sm text-foreground truncate">{b.title}</p>
                      <div className="flex flex-wrap gap-x-3 text-xs text-muted-foreground mt-1">
                        <span>📅 {new Date(b.period_start).toLocaleDateString("th-TH")} — {new Date(b.period_end).toLocaleDateString("th-TH")}</span>
                        <span>{b.total_jobs} งาน</span>
                        <span>{b.total_students} นศ.</span>
                        <span className="font-semibold text-emerald-700">{Number(b.total_amount).toLocaleString()} TRPB</span>
                      </div>
                      {b.approved_at && (
                        <p className="text-[10px] text-muted-foreground mt-1">
                          ✅ อนุมัติเมื่อ {new Date(b.approved_at).toLocaleDateString("th-TH")} โดย {b.approver?.name ?? "-"}
                        </p>
                      )}
                    </div>
                    <ChevronRight className="size-5 text-muted-foreground shrink-0" />
                  </CardContent>
                </Card>
              </Link>
            );
          })}
        </div>
      )}

      {/* Create modal */}
      {showCreate && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-end md:items-center justify-center p-4">
          <div className="bg-card rounded-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="px-5 py-4 border-b flex items-center justify-between sticky top-0 bg-card z-10">
              <h2 className="font-bold text-lg">สร้างรอบอนุมัติใหม่</h2>
              <Button variant="ghost" size="sm" onClick={() => setShowCreate(false)}>
                ปิด
              </Button>
            </div>

            <div className="p-5 space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs">วันเริ่ม</Label>
                  <Input type="date" value={periodStart} onChange={(e) => setPeriodStart(e.target.value)} />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">วันสิ้นสุด</Label>
                  <Input type="date" value={periodEnd} onChange={(e) => setPeriodEnd(e.target.value)} />
                </div>
              </div>

              <div className="rounded-lg border bg-amber-50/40 border-amber-200 p-3 text-xs text-amber-900">
                💡 เลือกงานที่ต้องการรวมในรอบ — ระบบจะออกเอกสารขออนุมัติ <strong>ฉบับเดียว</strong> ครอบคลุมทุกงาน
              </div>

              {loadingCandidates ? (
                <div className="flex justify-center py-8">
                  <Loader2 className="size-6 animate-spin text-amber-500" />
                </div>
              ) : candidates.length === 0 ? (
                <p className="text-center text-sm text-muted-foreground py-8">
                  ไม่มีงานในช่วงเวลานี้ (ที่ยังไม่อยู่ใน batch อื่น)
                </p>
              ) : (
                <>
                  <div className="flex items-center justify-between text-xs">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={selectedIds.size === candidates.length}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setSelectedIds(new Set(candidates.map((j) => j.id)));
                          } else {
                            setSelectedIds(new Set());
                          }
                        }}
                      />
                      <span>เลือกทั้งหมด ({candidates.length})</span>
                    </label>
                    <span className="text-muted-foreground">
                      เลือก {selectedIds.size}/{candidates.length}
                    </span>
                  </div>

                  <div className="space-y-1 max-h-72 overflow-y-auto border rounded-lg">
                    {candidates.map((j) => {
                      const checked = selectedIds.has(j.id);
                      return (
                        <label
                          key={j.id}
                          className={`flex items-start gap-2 p-2.5 cursor-pointer hover:bg-muted/50 border-b last:border-0 ${checked ? "bg-amber-50/40" : ""}`}
                        >
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={(e) => {
                              const next = new Set(selectedIds);
                              if (e.target.checked) next.add(j.id);
                              else next.delete(j.id);
                              setSelectedIds(next);
                            }}
                            className="mt-1"
                          />
                          <div className="flex-1 min-w-0 text-sm">
                            <p className="font-medium text-foreground truncate">{j.title}</p>
                            <div className="flex flex-wrap gap-x-2 text-xs text-muted-foreground">
                              <span>{TYPE_LABEL[j.type] ?? j.type}</span>
                              <span>·</span>
                              <span>{CATEGORY_LABEL[j.job_category] ?? j.job_category}</span>
                              <span>·</span>
                              <span>{j.employer?.name ?? "-"}</span>
                              <span>·</span>
                              <span>{j.required_workers} นศ.</span>
                              {j.pay_amount > 0 && (
                                <>
                                  <span>·</span>
                                  <span className="text-emerald-700 font-semibold">
                                    {Number(j.pay_amount).toLocaleString()} TRPB
                                  </span>
                                </>
                              )}
                            </div>
                          </div>
                        </label>
                      );
                    })}
                  </div>

                  <div className="rounded-lg bg-emerald-50 border border-emerald-200 p-3 text-sm">
                    <p className="font-medium text-emerald-900">สรุป (ที่จะรวมในรอบ)</p>
                    <p className="text-xs text-emerald-700 mt-1">
                      {selectedIds.size} งาน · {totalStudents} นศ. · <strong>{totalAmount.toLocaleString()} TRPB</strong>
                    </p>
                  </div>
                </>
              )}

              <div className="flex gap-2 pt-2">
                <Button
                  onClick={handleCreate}
                  disabled={selectedIds.size === 0 || creating}
                  className="flex-1 bg-amber-500 hover:bg-amber-600 text-white"
                >
                  {creating ? (
                    <>
                      <Loader2 className="size-4 mr-1 animate-spin" />
                      กำลังสร้าง...
                    </>
                  ) : (
                    <>
                      <FileText className="size-4 mr-1" />
                      สร้างรอบ ({selectedIds.size} งาน)
                    </>
                  )}
                </Button>
                <Button variant="outline" onClick={() => setShowCreate(false)}>
                  ยกเลิก
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
