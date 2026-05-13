"use client";

import { use, useEffect, useState } from "react";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import {
  ArrowLeft, Loader2, CheckCircle2, XCircle, UserCheck,
  Calendar, QrCode, Users, Sparkles,
} from "lucide-react";
import { UserAvatar } from "@/components/user-avatar";
import { TrustBadge } from "@/components/trust-badge";
import { cn } from "@/lib/utils";

interface Participant {
  student_id: string;
  role: string;
  attendance_status: string;
  checked_in_at: string | null;
  attended_at: string | null;
  paid_amount: number | null;
  student?: { name: string; email: string; avatar_url: string | null } | { name: string; email: string; avatar_url: string | null }[];
}

interface ActivityJob {
  id: string;
  title: string;
  engagement_mode: string;
  required_workers: number;
  pay_per_person: number | null;
  event_date: string | null;
  status: string;
  employer_id: string;
}

const STATUS_LABEL: Record<string, { label: string; color: string }> = {
  REGISTERED: { label: "ลงทะเบียน", color: "bg-slate-100 text-slate-700" },
  CHECKED_IN: { label: "เช็คอินแล้ว", color: "bg-amber-100 text-amber-800" },
  ATTENDED: { label: "เข้าร่วม ✓", color: "bg-emerald-100 text-emerald-700" },
  NO_SHOW: { label: "ไม่มา", color: "bg-red-100 text-red-700" },
  EXCUSED: { label: "ลา", color: "bg-blue-100 text-blue-700" },
  PAID: { label: "จ่ายแล้ว 💰", color: "bg-purple-100 text-purple-700" },
};

export default function ActivityAttendancePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [job, setJob] = useState<ActivityJob | null>(null);
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [releaseLoading, setReleaseLoading] = useState(false);

  async function load() {
    setLoading(true);
    const res = await fetch(`/api/jobs/${id}/attendance`);
    const data = await res.json();
    if (res.ok) {
      setJob(data.job);
      setParticipants(data.participants ?? []);
    } else {
      toast.error(data.error || "โหลดไม่สำเร็จ");
    }
    setLoading(false);
  }

  useEffect(() => { load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, []);

  async function updateOne(studentId: string, status: string) {
    setActionLoading(true);
    const res = await fetch(`/api/jobs/${id}/attendance`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ updates: [{ student_id: studentId, status }] }),
    });
    if (!res.ok) {
      const data = await res.json();
      toast.error(data.error || "Update ไม่สำเร็จ");
    } else {
      toast.success("อัปเดตแล้ว");
      await load();
    }
    setActionLoading(false);
  }

  async function autoAttend() {
    if (!confirm("ทำเครื่องหมาย ATTENDED ให้ทุกคนที่ CHECKED_IN หรือไม่?")) return;
    setActionLoading(true);
    const res = await fetch(`/api/jobs/${id}/attendance`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ auto_attend_checked_in: true }),
    });
    const data = await res.json();
    if (res.ok) {
      toast.success(`✓ Mark ${data.updated} คนเข้าร่วมแล้ว`);
      await load();
    } else {
      toast.error(data.error);
    }
    setActionLoading(false);
  }

  async function releaseEscrow() {
    const attended = participants.filter((p) => p.attendance_status === "ATTENDED").length;
    if (attended === 0) {
      toast.error("ไม่มีผู้ที่ ATTENDED — confirm attendance ก่อน");
      return;
    }
    if (!confirm(`ปล่อย TRPB ให้ ${attended} คน (คนละ ${Number(job?.pay_per_person ?? 0)} TRPB)?`)) return;
    setReleaseLoading(true);
    const res = await fetch(`/api/jobs/${id}/release-escrow`, { method: "POST" });
    const data = await res.json();
    if (res.ok) {
      toast.success(`✅ จ่าย TRPB เรียบร้อย: ${data.message}`);
      await load();
    } else {
      toast.error(data.error);
    }
    setReleaseLoading(false);
  }

  if (loading) return <div className="flex justify-center py-12"><Loader2 className="size-6 animate-spin text-sky-500" /></div>;
  if (!job) return <div className="text-center py-12">ไม่พบกิจกรรม</div>;

  const counts = {
    REGISTERED: 0, CHECKED_IN: 0, ATTENDED: 0, NO_SHOW: 0, EXCUSED: 0, PAID: 0,
  };
  for (const p of participants) {
    counts[p.attendance_status as keyof typeof counts] = (counts[p.attendance_status as keyof typeof counts] ?? 0) + 1;
  }
  const checkInUrl = typeof window !== "undefined" ? `${window.location.origin}/check-in/${id}` : `/check-in/${id}`;

  return (
    <div className="space-y-4 max-w-4xl">
      <div className="flex items-center gap-2">
        <Link href="/project-staff/active-jobs">
          <Button variant="ghost" size="sm">
            <ArrowLeft className="size-4 mr-1" />
            กลับ
          </Button>
        </Link>
      </div>

      {/* Activity header */}
      <Card className="border-amber-200 bg-amber-50/30">
        <CardHeader className="pb-3">
          <div className="flex items-start justify-between gap-2 flex-wrap">
            <div>
              <Badge className="bg-amber-100 text-amber-800 mb-1">🎉 กิจกรรมกลุ่ม</Badge>
              <CardTitle className="text-lg">{job.title}</CardTitle>
              <p className="text-xs text-muted-foreground mt-1">
                {job.event_date && (
                  <><Calendar className="size-3 inline mr-1" />
                  วันงาน: {new Date(job.event_date).toLocaleDateString("th-TH")} · </>
                )}
                จำนวน {job.required_workers} คน · {Number(job.pay_per_person ?? 0).toLocaleString()} TRPB/คน
              </p>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-3 md:grid-cols-6 gap-2 text-center">
            {Object.entries(STATUS_LABEL).map(([key, info]) => (
              <div key={key} className={`rounded-lg p-2 ${info.color}`}>
                <p className="text-2xl font-bold">{counts[key as keyof typeof counts] ?? 0}</p>
                <p className="text-[10px]">{info.label}</p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* QR for check-in */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <QrCode className="size-5 text-sky-600" />
            QR Code สำหรับ Check-in
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-4 flex-wrap">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={`/api/qr?text=${encodeURIComponent(checkInUrl)}&size=400`}
              alt="QR Check-in"
              className="size-40 rounded border bg-white"
            />
            <div className="text-sm space-y-1 flex-1 min-w-0">
              <p className="text-muted-foreground">นศ. สแกน QR นี้เพื่อ check-in</p>
              <p className="font-mono text-xs break-all bg-muted p-2 rounded">{checkInUrl}</p>
              <p className="text-[11px] text-amber-700">
                💡 แสดง QR ที่หน้างานหรือพิมพ์ติดป้าย — นศ. เปิดกล้องสแกนได้เลย
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Actions */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">การดำเนินการ</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <div className="flex flex-wrap gap-2">
            <Button onClick={autoAttend} disabled={actionLoading} variant="outline" className="border-emerald-200 text-emerald-700 hover:bg-emerald-50">
              <UserCheck className="size-4 mr-1" />
              Mark all CHECKED_IN → ATTENDED ({counts.CHECKED_IN})
            </Button>
            <Button onClick={releaseEscrow} disabled={releaseLoading || counts.ATTENDED === 0} className="bg-emerald-500 hover:bg-emerald-600 text-white">
              {releaseLoading ? <Loader2 className="size-4 mr-1 animate-spin" /> : <Sparkles className="size-4 mr-1" />}
              💸 จ่าย TRPB ให้ {counts.ATTENDED} คน
            </Button>
          </div>
          <p className="text-[11px] text-muted-foreground">
            ขั้นตอน: นศ. สมัคร → สแกน QR (CHECKED_IN) → staff confirm (ATTENDED) → ปล่อย TRPB (PAID) · NO_SHOW ไม่ได้เงิน
          </p>
        </CardContent>
      </Card>

      {/* Participants */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <Users className="size-5" />
            รายชื่อผู้สมัคร ({participants.length}/{job.required_workers})
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-1.5">
          {participants.length === 0 && (
            <p className="text-sm text-muted-foreground py-4 text-center">ยังไม่มีผู้สมัคร</p>
          )}
          {participants.map((p) => {
            const status = STATUS_LABEL[p.attendance_status] ?? STATUS_LABEL.REGISTERED;
            const student = Array.isArray(p.student) ? p.student[0] : p.student;
            return (
              <div
                key={p.student_id}
                className={cn(
                  "flex items-center gap-3 p-2.5 rounded-lg border",
                  p.attendance_status === "PAID" && "bg-purple-50/50 border-purple-200",
                  p.attendance_status === "ATTENDED" && "bg-emerald-50/50 border-emerald-200",
                )}
              >
                <UserAvatar userId={p.student_id} size="sm" />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <p className="text-sm font-medium truncate">{student?.name ?? p.student_id.slice(0, 8)}</p>
                    <TrustBadge userId={p.student_id} size="xs" />
                  </div>
                  <p className="text-[10px] text-muted-foreground truncate">
                    {p.checked_in_at && `เช็คอิน ${new Date(p.checked_in_at).toLocaleString("th-TH", { dateStyle: "short", timeStyle: "short" })}`}
                    {p.paid_amount && ` · ได้ ${p.paid_amount} TRPB`}
                  </p>
                </div>
                <Badge className={status.color}>{status.label}</Badge>
                {/* Quick actions */}
                {p.attendance_status !== "PAID" && (
                  <div className="flex gap-1">
                    {p.attendance_status !== "ATTENDED" && (
                      <Button size="sm" variant="ghost" onClick={() => updateOne(p.student_id, "ATTENDED")} disabled={actionLoading} className="h-7 px-2 text-emerald-600 hover:bg-emerald-50">
                        <CheckCircle2 className="size-4" />
                      </Button>
                    )}
                    {p.attendance_status !== "NO_SHOW" && (
                      <Button size="sm" variant="ghost" onClick={() => updateOne(p.student_id, "NO_SHOW")} disabled={actionLoading} className="h-7 px-2 text-red-600 hover:bg-red-50">
                        <XCircle className="size-4" />
                      </Button>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </CardContent>
      </Card>
    </div>
  );
}
