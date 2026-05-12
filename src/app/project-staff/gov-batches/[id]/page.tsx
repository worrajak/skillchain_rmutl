"use client";

import { useEffect, useRef, useState, use } from "react";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import {
  ArrowLeft, Download, Upload, Copy, CheckCircle2, XCircle,
  Loader2, FileText, ExternalLink, FileDigit,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface Batch {
  id: string;
  batch_no: string;
  title: string;
  period_start: string;
  period_end: string;
  status: string;
  document_md: string | null;
  document_pdf_url: string | null;
  approval_note: string | null;
  reject_reason: string | null;
  total_jobs: number;
  total_students: number;
  total_amount: number;
  created_at: string;
  compiled_at: string | null;
  approved_at: string | null;
  rejected_at: string | null;
  creator?: { name: string };
  approver?: { name: string } | null;
}

interface Job {
  id: string;
  title: string;
  type: string;
  job_category: string;
  pay_amount: number;
  required_workers: number;
  status: string;
  gov_status: string | null;
  employer?: { name: string };
}

const STATUS_LABEL: Record<string, { label: string; color: string }> = {
  PENDING: { label: "กำลังจัดทำ", color: "bg-slate-100 text-slate-700" },
  COMPILED: { label: "รอลายเซ็น", color: "bg-amber-100 text-amber-800" },
  APPROVED: { label: "อนุมัติแล้ว", color: "bg-emerald-100 text-emerald-800" },
  REJECTED: { label: "ถูกปฏิเสธ", color: "bg-red-100 text-red-700" },
  CLOSED: { label: "ปิดรอบ", color: "bg-gray-200 text-gray-700" },
};

export default function BatchDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [batch, setBatch] = useState<Batch | null>(null);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [showApprove, setShowApprove] = useState(false);
  const [showReject, setShowReject] = useState(false);
  const [approvalNote, setApprovalNote] = useState("");
  const [rejectReason, setRejectReason] = useState("");
  const pdfInputRef = useRef<HTMLInputElement>(null);
  const [uploadingPdf, setUploadingPdf] = useState(false);

  async function load() {
    setLoading(true);
    const res = await fetch(`/api/gov/batches/${id}`);
    const data = await res.json();
    if (res.ok) {
      setBatch(data.batch);
      setJobs(data.jobs ?? []);
    } else {
      toast.error(data.error || "โหลดข้อมูลไม่สำเร็จ");
    }
    setLoading(false);
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  async function copyMd() {
    if (!batch?.document_md) return;
    await navigator.clipboard.writeText(batch.document_md);
    toast.success("📋 คัดลอก Markdown แล้ว");
  }

  function downloadMd() {
    if (!batch?.document_md) return;
    const blob = new Blob([batch.document_md], { type: "text/markdown" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${batch.batch_no}.md`;
    a.click();
    URL.revokeObjectURL(url);
  }

  function downloadDocx() {
    window.location.href = `/api/gov/batches/${id}/docx`;
  }

  async function handleApprove() {
    setActionLoading(true);
    const res = await fetch(`/api/gov/batches/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "approve", note: approvalNote }),
    });
    const data = await res.json();
    setActionLoading(false);
    if (!res.ok) {
      toast.error(data.error || "อนุมัติไม่สำเร็จ");
      return;
    }
    toast.success("✅ อนุมัติรอบนี้แล้ว — งานทุกชิ้นปลดล็อก");
    setShowApprove(false);
    load();
  }

  async function handleReject() {
    if (!rejectReason.trim()) {
      toast.error("กรอกเหตุผลที่ปฏิเสธ");
      return;
    }
    setActionLoading(true);
    const res = await fetch(`/api/gov/batches/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "reject", reason: rejectReason }),
    });
    const data = await res.json();
    setActionLoading(false);
    if (!res.ok) {
      toast.error(data.error || "ปฏิเสธไม่สำเร็จ");
      return;
    }
    toast.success("ปฏิเสธรอบนี้แล้ว — งานทุกชิ้น rollback");
    setShowReject(false);
    load();
  }

  async function handlePdfUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingPdf(true);
    const fd = new FormData();
    fd.append("file", file);
    const res = await fetch(`/api/gov/batches/${id}/upload-pdf`, {
      method: "POST",
      body: fd,
    });
    const data = await res.json();
    setUploadingPdf(false);
    if (!res.ok) {
      toast.error(data.error || "Upload ไม่สำเร็จ");
      return;
    }
    toast.success("📄 อัปโหลด PDF ที่เซ็นแล้วสำเร็จ");
    load();
    e.target.value = "";
  }

  if (loading) {
    return <div className="flex justify-center py-12"><Loader2 className="size-6 animate-spin text-amber-500" /></div>;
  }
  if (!batch) {
    return <div className="text-center py-12">ไม่พบ batch นี้</div>;
  }

  const status = STATUS_LABEL[batch.status] ?? STATUS_LABEL.PENDING;
  const canApprove = batch.status === "COMPILED";
  const canReject = batch.status === "COMPILED";
  const canUploadPdf = ["COMPILED", "APPROVED"].includes(batch.status);

  return (
    <div className="space-y-4 max-w-5xl">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <Link href="/project-staff/gov-batches">
          <Button variant="ghost" size="sm">
            <ArrowLeft className="size-4 mr-1" />
            กลับ
          </Button>
        </Link>
      </div>

      {/* Header */}
      <Card className={cn(
        "border-2",
        batch.status === "APPROVED" && "border-emerald-300 bg-emerald-50/30",
        batch.status === "COMPILED" && "border-amber-300 bg-amber-50/30",
        batch.status === "REJECTED" && "border-red-300 bg-red-50/30",
      )}>
        <CardHeader className="pb-3">
          <div className="flex items-start justify-between gap-2 flex-wrap">
            <div className="min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <span className="font-mono text-sm font-bold text-amber-700">{batch.batch_no}</span>
                <Badge className={status.color}>{status.label}</Badge>
              </div>
              <CardTitle className="text-base">{batch.title}</CardTitle>
              <p className="text-xs text-muted-foreground mt-1">
                ช่วง {new Date(batch.period_start).toLocaleDateString("th-TH")} — {new Date(batch.period_end).toLocaleDateString("th-TH")}
                · สร้างโดย {batch.creator?.name ?? "-"} · {new Date(batch.created_at).toLocaleString("th-TH")}
              </p>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-3 gap-3 text-center">
            <div>
              <p className="text-2xl font-bold text-foreground">{batch.total_jobs}</p>
              <p className="text-xs text-muted-foreground">งาน</p>
            </div>
            <div>
              <p className="text-2xl font-bold text-foreground">{batch.total_students}</p>
              <p className="text-xs text-muted-foreground">นักศึกษา</p>
            </div>
            <div>
              <p className="text-2xl font-bold text-emerald-700">{Number(batch.total_amount).toLocaleString()}</p>
              <p className="text-xs text-muted-foreground">TRPB</p>
            </div>
          </div>

          {batch.approved_at && (
            <div className="mt-3 rounded-md bg-emerald-100 border border-emerald-300 p-2 text-xs text-emerald-900">
              ✅ อนุมัติเมื่อ {new Date(batch.approved_at).toLocaleString("th-TH")} โดย <strong>{batch.approver?.name ?? "-"}</strong>
              {batch.approval_note && <p className="mt-1">หมายเหตุ: {batch.approval_note}</p>}
            </div>
          )}
          {batch.rejected_at && batch.reject_reason && (
            <div className="mt-3 rounded-md bg-red-100 border border-red-300 p-2 text-xs text-red-900">
              ❌ ปฏิเสธเมื่อ {new Date(batch.rejected_at).toLocaleString("th-TH")}
              <p className="mt-1"><strong>เหตุผล:</strong> {batch.reject_reason}</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Document actions */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <FileText className="size-5 text-amber-600" />
            เอกสาร
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex flex-wrap gap-2">
            <Button onClick={downloadDocx} className="bg-blue-500 hover:bg-blue-600 text-white">
              <FileDigit className="size-4 mr-1" />
              ดาวน์โหลด .docx (Word)
            </Button>
            <Button variant="outline" onClick={downloadMd}>
              <Download className="size-4 mr-1" />
              .md
            </Button>
            <Button variant="outline" onClick={copyMd}>
              <Copy className="size-4 mr-1" />
              Copy Markdown
            </Button>
          </div>

          {canUploadPdf && (
            <div className="border-t pt-3 space-y-1.5">
              <p className="text-xs text-muted-foreground">📄 ถ้ามีไฟล์ PDF ที่เซ็นแล้ว สามารถอัปโหลดไว้เป็น attachment</p>
              <input
                ref={pdfInputRef}
                type="file"
                accept="application/pdf,image/*"
                className="hidden"
                onChange={handlePdfUpload}
              />
              <Button
                variant="outline"
                onClick={() => pdfInputRef.current?.click()}
                disabled={uploadingPdf}
              >
                {uploadingPdf ? <Loader2 className="size-4 mr-1 animate-spin" /> : <Upload className="size-4 mr-1" />}
                {batch.document_pdf_url ? "อัปโหลดใหม่" : "อัปโหลด PDF ที่เซ็นแล้ว"}
              </Button>
              {batch.document_pdf_url && (
                <a
                  href={batch.document_pdf_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-xs text-blue-600 hover:underline ml-2"
                >
                  <ExternalLink className="size-3" />
                  ดูไฟล์ที่อัปโหลด
                </a>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Approve / Reject actions */}
      {(canApprove || canReject) && (
        <Card className="border-amber-300 bg-amber-50/30">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">การดำเนินการ</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <p className="text-xs text-muted-foreground">
              เมื่อผู้บริหารเซ็นเอกสารแล้ว กดปุ่ม &ldquo;อนุมัติแล้ว&rdquo; เพื่อปลดล็อกงานทุกชิ้นในรอบ
            </p>
            <div className="flex gap-2 flex-wrap">
              <Button
                onClick={() => setShowApprove(true)}
                className="bg-emerald-500 hover:bg-emerald-600 text-white"
                disabled={!canApprove}
              >
                <CheckCircle2 className="size-4 mr-1" />
                อนุมัติแล้ว
              </Button>
              <Button
                onClick={() => setShowReject(true)}
                variant="outline"
                className="text-red-600 border-red-200 hover:bg-red-50"
                disabled={!canReject}
              >
                <XCircle className="size-4 mr-1" />
                ปฏิเสธ
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Markdown preview */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">เนื้อหาเอกสาร (Markdown preview)</CardTitle>
        </CardHeader>
        <CardContent>
          <pre className="text-[11px] bg-muted p-3 rounded-md overflow-x-auto whitespace-pre-wrap max-h-96 overflow-y-auto leading-relaxed font-mono">
            {batch.document_md ?? "(ไม่มีเนื้อหา)"}
          </pre>
        </CardContent>
      </Card>

      {/* Jobs in batch */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">งานในรอบนี้ ({jobs.length})</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {jobs.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4 text-center">ไม่มีงาน</p>
          ) : (
            jobs.map((j) => (
              <Link key={j.id} href={`/project-staff/active-jobs?id=${j.id}`}>
                <div className="border rounded-lg p-3 hover:bg-muted/30 cursor-pointer">
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <p className="font-medium text-sm flex-1 min-w-0 truncate">{j.title}</p>
                    {j.pay_amount > 0 && (
                      <span className="text-sm font-semibold text-emerald-700">
                        {Number(j.pay_amount).toLocaleString()} TRPB
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {j.employer?.name ?? "-"} · {j.required_workers} นศ. · gov: {j.gov_status ?? "—"}
                  </p>
                </div>
              </Link>
            ))
          )}
        </CardContent>
      </Card>

      {/* Approve modal */}
      {showApprove && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="bg-card rounded-xl w-full max-w-md p-5 space-y-3">
            <h2 className="font-bold text-lg">ยืนยันการอนุมัติ</h2>
            <p className="text-sm text-muted-foreground">
              เมื่อกดอนุมัติ — งาน {batch.total_jobs} ชิ้นในรอบจะ unlock ให้ดำเนินการต่อ
              และส่ง notification ให้ผู้เกี่ยวข้องทั้งหมด
            </p>
            <Textarea
              placeholder="หมายเหตุการอนุมัติ (ไม่บังคับ)"
              value={approvalNote}
              onChange={(e) => setApprovalNote(e.target.value)}
              rows={3}
            />
            <div className="flex gap-2 pt-2">
              <Button onClick={handleApprove} disabled={actionLoading} className="flex-1 bg-emerald-500 hover:bg-emerald-600 text-white">
                {actionLoading ? <Loader2 className="size-4 mr-1 animate-spin" /> : <CheckCircle2 className="size-4 mr-1" />}
                ยืนยันอนุมัติ
              </Button>
              <Button variant="outline" onClick={() => setShowApprove(false)}>ยกเลิก</Button>
            </div>
          </div>
        </div>
      )}

      {/* Reject modal */}
      {showReject && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="bg-card rounded-xl w-full max-w-md p-5 space-y-3">
            <h2 className="font-bold text-lg">ปฏิเสธรอบ</h2>
            <p className="text-sm text-muted-foreground">
              งานในรอบจะถูกปลดออก (gov_status → PROJECT_DRAFT) สามารถนำกลับมารวมในรอบใหม่ได้
            </p>
            <Textarea
              placeholder="เหตุผลที่ปฏิเสธ (บังคับ)"
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              rows={3}
            />
            <div className="flex gap-2 pt-2">
              <Button onClick={handleReject} disabled={actionLoading || !rejectReason.trim()} variant="outline" className="flex-1 text-red-600 border-red-300 hover:bg-red-50">
                {actionLoading ? <Loader2 className="size-4 mr-1 animate-spin" /> : <XCircle className="size-4 mr-1" />}
                ยืนยันปฏิเสธ
              </Button>
              <Button variant="outline" onClick={() => setShowReject(false)}>ยกเลิก</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
