"use client";

import { useEffect, useState, useRef } from "react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ImageGallery } from "@/components/image-gallery";
import { cn } from "@/lib/utils";
import {
  ClipboardCheck,
  CheckCircle,
  XCircle,
  Wallet,
  MapPin,
  Clock,
  MessageCircle,
  Send,
  User,
} from "lucide-react";
import { toast } from "sonner";
import { getCampusLabel } from "@/types/database";

const TYPE_LABELS: Record<string, string> = {
  PAID: "งานจ้าง",
  VOLUNTEER: "จิตอาสา",
  TRAINING: "ฝึกทักษะ",
  EXEMPTED: "ยกเว้นค่าบริการ",
};
const CATEGORY_LABELS: Record<string, string> = {
  electrical: "ไฟฟ้า",
  hvac: "แอร์/เครื่องเย็น",
  automotive: "ยานยนต์",
  general: "ทั่วไป",
};

interface ChatMessage {
  id: string;
  content: string;
  sender_id: string;
  sender?: { name: string; role: string };
  created_at: string;
}

export default function StaffReviewJobsPage() {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [jobs, setJobs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [userId, setUserId] = useState<string | null>(null);

  // Per-job state
  const [adjustedPay, setAdjustedPay] = useState<Record<string, string>>({});
  const [reviewNote, setReviewNote] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState<string | null>(null);

  // Chat state
  const [openChat, setOpenChat] = useState<string | null>(null);
  const [chatMessages, setChatMessages] = useState<Record<string, ChatMessage[]>>({});
  const [chatInput, setChatInput] = useState("");
  const chatEndRef = useRef<HTMLDivElement>(null);

  const supabase = createClient();

  useEffect(() => {
    async function init() {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (user) setUserId(user.id);
    }
    init();
  }, []);

  async function loadJobs() {
    setLoading(true);
    const { data } = await supabase
      .from("jobs")
      .select(
        "*, employer:users!jobs_employer_id_fkey(name, email, job_quota, job_quota_used)"
      )
      .eq("status", "PENDING_REVIEW")
      .order("created_at", { ascending: false });
    setJobs(data ?? []);
    setLoading(false);
  }

  useEffect(() => {
    loadJobs();
  }, []);

  async function loadChat(jobId: string) {
    const res = await fetch(`/api/chat/${jobId}`);
    if (res.ok) {
      const data = await res.json();
      setChatMessages((prev) => ({ ...prev, [jobId]: data.messages ?? [] }));
    }
  }

  async function handleOpenChat(jobId: string) {
    if (openChat === jobId) {
      setOpenChat(null);
      return;
    }
    setOpenChat(jobId);
    await loadChat(jobId);
    setTimeout(
      () => chatEndRef.current?.scrollIntoView({ behavior: "smooth" }),
      100
    );
  }

  async function handleSendChat(jobId: string) {
    if (!chatInput.trim()) return;
    const res = await fetch(`/api/chat/${jobId}/messages`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content: chatInput, message_type: "TEXT" }),
    });
    if (res.ok) {
      const msg = await res.json();
      setChatMessages((prev) => ({
        ...prev,
        [jobId]: [...(prev[jobId] ?? []), msg],
      }));
      setChatInput("");
      setTimeout(
        () => chatEndRef.current?.scrollIntoView({ behavior: "smooth" }),
        50
      );
    }
  }

  async function handleAction(jobId: string, action: "APPROVE" | "REJECT") {
    setSubmitting(jobId);
    const res = await fetch(`/api/jobs/${jobId}/review-job`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action,
        adjusted_pay: adjustedPay[jobId]
          ? parseFloat(adjustedPay[jobId])
          : undefined,
        note: reviewNote[jobId] || undefined,
      }),
    });
    const data = await res.json();
    setSubmitting(null);
    if (res.ok) {
      if (action === "APPROVE") {
        const msg = data.adjusted
          ? `อนุมัติแล้ว — ปรับค่าจ้างเป็น ${data.final_pay?.toLocaleString()} TRPB`
          : "อนุมัติแล้ว — งานเปิดรับนักศึกษา";
        toast.success(msg);
      } else {
        toast.success("ปฏิเสธงานแล้ว");
      }
      loadJobs();
    } else {
      toast.error(data.error);
    }
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-foreground flex items-center gap-2">
            <ClipboardCheck className="size-5" />
            งานรอพิจารณา ({jobs.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex justify-center py-8">
              <div className="animate-spin size-6 border-4 border-orange-500 border-t-transparent rounded-full" />
            </div>
          ) : jobs.length > 0 ? (
            <div className="space-y-4">
              {jobs.map((job) => {
                const employer = job.employer as {
                  name: string;
                  email: string;
                  job_quota: number;
                  job_quota_used: number;
                } | null;
                const remaining = Math.max(
                  0,
                  (employer?.job_quota ?? 0) - (employer?.job_quota_used ?? 0)
                );

                return (
                  <div
                    key={job.id}
                    className="rounded-lg border p-4 space-y-3"
                  >
                    {/* Job Header */}
                    <div className="flex items-start justify-between">
                      <div>
                        <div className="font-medium text-foreground">
                          {job.title}
                        </div>
                        <div className="flex flex-wrap gap-1.5 mt-1">
                          <span className="inline-flex rounded-full bg-orange-100 text-orange-800 px-2 py-0.5 text-xs font-medium">
                            {TYPE_LABELS[job.type] ?? job.type}
                          </span>
                          <span className="inline-flex rounded-full bg-gray-100 text-gray-700 px-2 py-0.5 text-xs font-medium">
                            {CATEGORY_LABELS[job.job_category] ??
                              job.job_category}
                          </span>
                        </div>
                      </div>
                      <div className="text-right text-xs text-muted-foreground">
                        {new Date(job.created_at).toLocaleDateString("th-TH")}
                      </div>
                    </div>

                    {/* Description */}
                    <p className="text-sm text-muted-foreground">
                      {job.description}
                    </p>

                    {/* Job Details */}
                    <div className="flex flex-wrap gap-4 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <MapPin className="size-3" />
                        {job.location} ({getCampusLabel(String(job.campus))})
                      </span>
                      <span className="flex items-center gap-1">
                        <Clock className="size-3" />
                        กำหนด:{" "}
                        {new Date(job.deadline).toLocaleDateString("th-TH")}
                      </span>
                      {job.pay_amount > 0 && (
                        <span className="flex items-center gap-1 text-green-700 font-medium">
                          <Wallet className="size-3" />
                          {job.pay_amount.toLocaleString()} TRPB
                        </span>
                      )}
                    </div>

                    {/* Employer Info + Quota */}
                    <div className="flex items-center justify-between rounded-lg bg-blue-50 p-2">
                      <div className="flex items-center gap-2 text-sm">
                        <User className="size-4 text-blue-600" />
                        <span className="text-foreground font-medium">
                          {employer?.name ?? "ไม่ระบุ"}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          ({employer?.email})
                        </span>
                      </div>
                      {employer?.job_quota && employer.job_quota > 0 ? (
                        <span
                          className={cn(
                            "text-xs font-medium px-2 py-0.5 rounded-full",
                            remaining > 0
                              ? "bg-green-100 text-green-700"
                              : "bg-red-100 text-red-700"
                          )}
                        >
                          โควต้า: {employer.job_quota_used}/
                          {employer.job_quota} (เหลือ {remaining})
                        </span>
                      ) : (
                        <span className="text-xs text-muted-foreground">
                          ไม่มีโควต้า
                        </span>
                      )}
                    </div>

                    {/* Job Images */}
                    <ImageGallery
                      jobId={job.id}
                      imageType="job"
                      label="รูปเครื่อง/ลักษณะงาน"
                    />

                    {/* Pay Adjustment */}
                    {job.type === "PAID" && job.pay_amount > 0 && (
                      <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 space-y-2">
                        <div className="text-sm font-medium text-amber-800">
                          พิจารณาค่าตอบแทน
                        </div>
                        <div className="flex items-center gap-3">
                          <div className="text-xs text-muted-foreground">
                            ผู้จ้างเสนอ:{" "}
                            <span className="font-bold text-foreground">
                              {job.pay_amount.toLocaleString()} TRPB
                            </span>
                          </div>
                          <div className="flex items-center gap-1">
                            <span className="text-xs text-muted-foreground">
                              ปรับเป็น:
                            </span>
                            <Input
                              type="number"
                              min="0"
                              placeholder={String(job.pay_amount)}
                              value={adjustedPay[job.id] ?? ""}
                              onChange={(e) =>
                                setAdjustedPay((prev) => ({
                                  ...prev,
                                  [job.id]: e.target.value,
                                }))
                              }
                              className="w-28 h-8 text-sm"
                            />
                            <span className="text-xs text-muted-foreground">
                              TRPB
                            </span>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Review Note */}
                    <Textarea
                      placeholder="หมายเหตุ/เหตุผล (ไม่บังคับ)"
                      value={reviewNote[job.id] ?? ""}
                      onChange={(e) =>
                        setReviewNote((prev) => ({
                          ...prev,
                          [job.id]: e.target.value,
                        }))
                      }
                      rows={2}
                    />

                    {/* Chat Toggle */}
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleOpenChat(job.id)}
                      className="w-full"
                    >
                      <MessageCircle className="size-4 mr-1" />
                      {openChat === job.id
                        ? "ปิดแชท"
                        : "เปิดแชทต่อรองกับผู้ว่าจ้าง"}
                    </Button>

                    {/* Mini Chat */}
                    {openChat === job.id && (
                      <div className="rounded-lg border bg-white p-3 space-y-2">
                        <div className="max-h-48 overflow-y-auto space-y-2">
                          {(chatMessages[job.id] ?? []).length === 0 ? (
                            <p className="text-xs text-muted-foreground text-center py-4">
                              ยังไม่มีข้อความ —
                              เริ่มแชทเพื่อต่อรองค่าตอบแทนกับผู้ว่าจ้าง
                            </p>
                          ) : (
                            (chatMessages[job.id] ?? []).map((msg) => (
                              <div
                                key={msg.id}
                                className={cn(
                                  "flex flex-col text-xs rounded-lg p-2 max-w-[80%]",
                                  msg.sender_id === userId
                                    ? "ml-auto bg-purple-100 text-purple-900"
                                    : "bg-gray-100 text-gray-900"
                                )}
                              >
                                <span className="font-medium text-[10px] opacity-70">
                                  {msg.sender?.name ?? "ไม่ระบุ"} (
                                  {msg.sender?.role})
                                </span>
                                <span>{msg.content}</span>
                              </div>
                            ))
                          )}
                          <div ref={chatEndRef} />
                        </div>
                        <div className="flex gap-2">
                          <Input
                            placeholder="พิมพ์ข้อความ..."
                            value={openChat === job.id ? chatInput : ""}
                            onChange={(e) => setChatInput(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === "Enter" && !e.shiftKey) {
                                e.preventDefault();
                                handleSendChat(job.id);
                              }
                            }}
                            className="h-8 text-sm"
                          />
                          <Button
                            size="sm"
                            onClick={() => handleSendChat(job.id)}
                            className="h-8"
                          >
                            <Send className="size-3" />
                          </Button>
                        </div>
                      </div>
                    )}

                    {/* Action Buttons */}
                    <div className="flex gap-2 pt-1">
                      <Button
                        size="sm"
                        className="flex-1"
                        onClick={() => handleAction(job.id, "APPROVE")}
                        disabled={submitting === job.id}
                      >
                        <CheckCircle className="size-4 mr-1" />
                        {submitting === job.id
                          ? "กำลังดำเนินการ..."
                          : adjustedPay[job.id]
                            ? `อนุมัติ (${Number(adjustedPay[job.id]).toLocaleString()} TRPB)`
                            : "อนุมัติตามที่เสนอ"}
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="text-red-600"
                        onClick={() => handleAction(job.id, "REJECT")}
                        disabled={submitting === job.id}
                      >
                        <XCircle className="size-4 mr-1" />
                        ปฏิเสธ
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="text-center text-muted-foreground py-8">
              ไม่มีงานรอพิจารณา
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
