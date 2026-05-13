"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { AlertTriangle, CheckCircle, Home, Camera } from "lucide-react";
import { AIJobEstimator } from "@/components/ai-job-estimator";
import { toast } from "sonner";
import { JOB_POSTER_ROLES } from "@/types/database";
import type { UserRole } from "@/types/database";
import { ImageUpload } from "@/components/image-upload";

interface Props {
  /** Where to go after success (defaults to "/") */
  homeUrl?: string;
}

/**
 * Reusable Job Creation Form.
 * Used by /employer/jobs/new, /admin/jobs/new, and /project-staff/jobs/new
 * — each renders within its own role-specific layout (sidebar / nav).
 */
export default function NewJobForm({ homeUrl = "/" }: Props) {
  const [userRole, setUserRole] = useState<UserRole | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [createdJobId, setCreatedJobId] = useState<string | null>(null);
  const [quota, setQuota] = useState<{ job_quota: number; job_quota_used: number } | null>(null);

  // Form fields
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [jobType, setJobType] = useState("PAID");
  const [jobCategory, setJobCategory] = useState("general");
  const [location, setLocation] = useState("");
  const [campus, setCampus] = useState("huaykaew");
  const [payAmount, setPayAmount] = useState("");
  const [deadline, setDeadline] = useState("");
  const [isMentorship, setIsMentorship] = useState(false);
  const [requiredWorkers, setRequiredWorkers] = useState(1);
  // ACTIVITY mode — กิจกรรมหมู่ 20-100 คน · จ่ายรายคน
  const [engagementMode, setEngagementMode] = useState<"SOLO" | "ACTIVITY">("SOLO");
  const [payPerPerson, setPayPerPerson] = useState(""); // net to student
  const [eventDate, setEventDate] = useState("");

  const supabase = createClient();

  useEffect(() => {
    async function init() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      setUserId(user.id);
      const { data: profile } = await supabase
        .from("skc_users")
        .select("role, job_quota, job_quota_used")
        .eq("id", user.id)
        .single();
      if (profile) {
        setUserRole(profile.role as UserRole);
        if (profile.job_quota > 0) {
          setQuota({ job_quota: profile.job_quota, job_quota_used: profile.job_quota_used ?? 0 });
        }
      }
    }
    init();
  }, []);

  const canPost = userRole && JOB_POSTER_ROLES.includes(userRole);
  const isSimulated = userRole && ["teacher", "project_staff", "rmutl_staff", "admin", "superadmin"].includes(userRole);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    console.log("[NewJobForm] submit clicked", { userId, canPost, userRole });

    if (!userId) {
      toast.error("ไม่พบข้อมูลผู้ใช้ — กรุณา login ใหม่");
      console.error("[NewJobForm] missing userId");
      return;
    }
    if (!canPost) {
      toast.error(`role "${userRole}" ไม่มีสิทธิ์สร้างงาน`);
      console.error("[NewJobForm] role cannot post:", userRole);
      return;
    }

    setLoading(true);

    const isActivity = engagementMode === "ACTIVITY";
    const cap = isActivity ? 100 : 20;

    // For ACTIVITY: pay_per_person is NET to student → gross up for 10% fees
    // → store as pay_amount = perPerson / 0.9 (rounded up)
    // The release-escrow API will know to multiply by attended count
    const perPerson = parseFloat(payPerPerson) || 0;
    const grossPerPerson = isActivity ? Math.ceil(perPerson / 0.9) : 0;

    const payload = {
      title,
      description,
      type: jobType,
      job_category: jobCategory,
      location,
      campus,
      pay_amount: isActivity
        ? grossPerPerson * Math.max(1, Math.min(cap, requiredWorkers))
        : (parseFloat(payAmount) || 0),
      deadline: new Date(deadline || eventDate).toISOString(),
      employer_id: userId,
      is_mentorship: isMentorship,
      required_workers: Math.max(1, Math.min(cap, requiredWorkers)),
      status: "PENDING_REVIEW",
      // Activity-specific fields
      engagement_mode: engagementMode,
      pay_per_person: isActivity ? grossPerPerson : null,
      event_date: isActivity && eventDate ? eventDate : null,
      registration_mode: isActivity ? "FCFS" : "STAFF_APPROVE",
    };
    console.log("[NewJobForm] inserting:", payload);

    try {
      const { data: newJob, error } = await supabase
        .from("skc_jobs")
        .insert(payload)
        .select("id")
        .single();

      console.log("[NewJobForm] response:", { newJob, error });
      setLoading(false);

      if (error) {
        console.error("[NewJobForm] insert error:", error);
        toast.error(`สร้างงานไม่สำเร็จ: ${error.message}${error.details ? "\n" + error.details : ""}${error.hint ? "\n" + error.hint : ""}`);
        return;
      }

      toast.success("ลงงานสำเร็จ! — รอคณะทำงานพิจารณาค่าตอบแทน");
      setCreatedJobId(newJob?.id ?? null);
      setSuccess(true);
    } catch (e) {
      setLoading(false);
      console.error("[NewJobForm] unexpected error:", e);
      const msg = e instanceof Error ? e.message : String(e);
      toast.error(`เกิดข้อผิดพลาด: ${msg}`);
    }
  }

  if (success) {
    return (
      <div className="max-w-md mx-auto mt-10 space-y-4">
        <Card className="text-center">
          <CardContent className="py-10 space-y-4">
            <CheckCircle className="size-16 mx-auto text-green-500" />
            <h2 className="text-xl font-bold text-foreground">ลงงานสำเร็จ!</h2>
            <p className="text-sm text-muted-foreground">
              งานอยู่ระหว่างรอคณะทำงานพิจารณาค่าตอบแทน
              <br />
              เมื่ออนุมัติแล้วจะปรากฏในหน้า Job Board
            </p>
          </CardContent>
        </Card>

        {createdJobId && (
          <Card>
            <CardHeader>
              <CardTitle className="text-foreground text-sm flex items-center gap-2">
                <Camera className="size-5 text-blue-600" />
                เพิ่มรูปเครื่อง/ลักษณะงาน (2-4 รูป)
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-xs text-muted-foreground mb-3">
                ถ่ายรูปเครื่องจักร อุปกรณ์ หรือลักษณะงานที่ต้องซ่อม
                <br />
                💡 อัพได้ภายหลังจากปุ่ม "ดูงาน" ด้านล่าง
              </p>
              <ImageUpload jobId={createdJobId} imageType="job" maxImages={4} />
            </CardContent>
          </Card>
        )}

        <div className="grid grid-cols-2 gap-2">
          {createdJobId && (
            <Link href={`/employer/jobs/${createdJobId}`}>
              <Button className="w-full" variant="default">
                ดูงานที่สร้าง →
              </Button>
            </Link>
          )}
          <Button variant="outline" onClick={() => { setSuccess(false); setCreatedJobId(null); setTitle(""); setDescription(""); }}>
            ลงงานอีกชิ้น
          </Button>
        </div>

        <Link href={homeUrl}>
          <Button variant="ghost" className="w-full">
            <Home className="size-4 mr-1" />
            กลับหน้าหลัก
          </Button>
        </Link>
      </div>
    );
  }

  if (userRole && !canPost) {
    return (
      <div className="max-w-md mx-auto mt-10">
        <Card>
          <CardContent className="py-10 text-center space-y-3">
            <AlertTriangle className="size-12 mx-auto text-yellow-500" />
            <p className="font-medium text-foreground">ไม่มีสิทธิ์ลงงาน</p>
            <p className="text-sm text-muted-foreground">เฉพาะผู้ว่าจ้าง อาจารย์ หรือคณะทำงานเท่านั้น</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      {isSimulated && (
        <div className="flex items-center gap-2 rounded-lg border border-blue-200 bg-blue-50 p-3 text-sm text-blue-800">
          <AlertTriangle className="size-4 shrink-0" />
          <span>
            คุณกำลังสร้าง<strong>งานจ้างเทียม</strong> (ทดสอบทักษะ/ทดลองระบบ) ในฐานะ {userRole}
          </span>
        </div>
      )}

      {quota && (
        <div className={`flex items-center justify-between rounded-lg border p-3 text-sm ${quota.job_quota_used >= quota.job_quota ? "border-red-200 bg-red-50 text-red-800" : "border-green-200 bg-green-50 text-green-800"}`}>
          <span>โควต้างานจ้าง: ใช้ไป {quota.job_quota_used}/{quota.job_quota} ครั้ง</span>
          <span className="font-bold">เหลือ {Math.max(0, quota.job_quota - quota.job_quota_used)} ครั้ง</span>
        </div>
      )}

      {/* AI Job Estimator — ถ่ายรูปแล้ว AI ช่วยกรอกฟอร์ม */}
      <AIJobEstimator
        onApply={(e) => {
          setTitle(e.title);
          setDescription(e.description);
          setJobCategory(e.category);
          const mid = Math.round((e.estimated_pay_min + e.estimated_pay_max) / 2);
          setPayAmount(String(mid));
        }}
      />

      {/* Engagement mode toggle — SOLO/TEAM vs ACTIVITY */}
      <Card className="border-amber-200 bg-amber-50/40">
        <CardHeader className="pb-2">
          <CardTitle className="text-foreground text-base">ประเภทการมีส่วนร่วม</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <label className={`rounded-lg border-2 p-3 cursor-pointer transition-all ${engagementMode === "SOLO" ? "border-amber-500 bg-white" : "border-slate-200 bg-white/50 hover:border-amber-300"}`}>
              <input
                type="radio"
                name="engagement_mode"
                value="SOLO"
                checked={engagementMode === "SOLO"}
                onChange={() => setEngagementMode("SOLO")}
                className="sr-only"
              />
              <div className="flex items-center gap-2 mb-1">
                <span className="text-2xl">👤</span>
                <span className="font-semibold text-foreground">งานเดี่ยว / ทีมเล็ก</span>
              </div>
              <p className="text-xs text-muted-foreground">1-20 คน · ส่งงานร่วมกัน · หารค่าจ้างเท่าๆ กัน</p>
            </label>
            <label className={`rounded-lg border-2 p-3 cursor-pointer transition-all ${engagementMode === "ACTIVITY" ? "border-amber-500 bg-white" : "border-slate-200 bg-white/50 hover:border-amber-300"}`}>
              <input
                type="radio"
                name="engagement_mode"
                value="ACTIVITY"
                checked={engagementMode === "ACTIVITY"}
                onChange={() => setEngagementMode("ACTIVITY")}
                className="sr-only"
              />
              <div className="flex items-center gap-2 mb-1">
                <span className="text-2xl">🎉</span>
                <span className="font-semibold text-foreground">กิจกรรมหมู่</span>
              </div>
              <p className="text-xs text-muted-foreground">20-100 คน · check-in รายคน · จ่ายต่อคน fixed rate</p>
            </label>
          </div>
        </CardContent>
      </Card>

      <form onSubmit={handleSubmit} className="space-y-6">
        <Card>
          <CardHeader><CardTitle className="text-foreground">รายละเอียดงาน</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label className="text-foreground">ชื่องาน</Label>
              <Input placeholder="เช่น ซ่อมแอร์ตึก A ชั้น 3" value={title} onChange={(e) => setTitle(e.target.value)} required />
            </div>
            <div className="space-y-2">
              <Label className="text-foreground">รายละเอียด</Label>
              <Textarea placeholder="อธิบายงานที่ต้องทำ" value={description} onChange={(e) => setDescription(e.target.value)} rows={4} required />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label className="text-foreground">ประเภทงาน</Label>
                <Select value={jobType} onValueChange={(v) => v && setJobType(v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="PAID">งานจ้าง (PAID)</SelectItem>
                    <SelectItem value="VOLUNTEER">จิตอาสา (VOLUNTEER)</SelectItem>
                    <SelectItem value="TRAINING">ฝึกทักษะ (TRAINING)</SelectItem>
                    <SelectItem value="EXEMPTED">ยกเว้นค่าบริการ (EXEMPTED)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label className="text-foreground">หมวดงาน</Label>
                <Select value={jobCategory} onValueChange={(v) => v && setJobCategory(v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="electrical">ไฟฟ้า</SelectItem>
                    <SelectItem value="hvac">แอร์/เครื่องเย็น</SelectItem>
                    <SelectItem value="automotive">ยานยนต์</SelectItem>
                    <SelectItem value="general">ทั่วไป</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-foreground">สถานที่ & กำหนดเวลา</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label className="text-foreground">สถานที่ทำงาน</Label>
              <Input placeholder="เช่น ตึกวิศวกรรม ชั้น 2 ห้อง 201" value={location} onChange={(e) => setLocation(e.target.value)} required />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label className="text-foreground">วิทยาเขต</Label>
                <Select value={campus} onValueChange={(v) => v && setCampus(v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="huaykaew">เชียงใหม่ (ห้วยแก้ว)</SelectItem>
                    <SelectItem value="doisaket">เชียงใหม่ (ดอยสะเก็ด)</SelectItem>
                    <SelectItem value="chiangrai">เชียงราย</SelectItem>
                    <SelectItem value="lampang">ลำปาง</SelectItem>
                    <SelectItem value="tak">ตาก</SelectItem>
                    <SelectItem value="nan">น่าน</SelectItem>
                    <SelectItem value="phitsanulok">พิษณุโลก</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label className="text-foreground">กำหนดส่งงาน</Label>
                <Input type="date" value={deadline} onChange={(e) => setDeadline(e.target.value)} required />
              </div>
            </div>
            {jobType === "PAID" && engagementMode === "SOLO" && (
              <div className="space-y-2">
                <Label className="text-foreground">ค่าจ้าง (TRPB)</Label>
                <Input type="number" placeholder="0" value={payAmount} onChange={(e) => setPayAmount(e.target.value)} min="0" />
              </div>
            )}
            <label className="flex items-center gap-3 cursor-pointer">
              <input type="checkbox" checked={isMentorship} onChange={(e) => setIsMentorship(e.target.checked)} className="size-4 rounded" />
              <div>
                <div className="text-sm font-medium text-foreground">งานนี้ต้องมี Mentor</div>
                <div className="text-xs text-muted-foreground">นักศึกษาระดับ 2 ต้องมีพี่เลี้ยงดูแล</div>
              </div>
            </label>

            {engagementMode === "SOLO" ? (
              /* Team size — multi-worker support (MVP equal split) */
              <div className="space-y-2 pt-2 border-t">
                <Label className="text-foreground">จำนวนนักศึกษาที่ต้องการ (ทีม)</Label>
                <div className="flex items-center gap-3">
                  <Input
                    type="number"
                    min={1}
                    max={20}
                    value={requiredWorkers}
                    onChange={(e) => setRequiredWorkers(parseInt(e.target.value) || 1)}
                    className="w-24"
                  />
                  <span className="text-sm text-muted-foreground">
                    {requiredWorkers === 1 ? "งานเดี่ยว — 1 คน" : `งานทีม — ${requiredWorkers} คน`}
                  </span>
                </div>
                {requiredWorkers > 1 && payAmount && (
                  <p className="text-xs text-emerald-700 bg-emerald-50 rounded p-2">
                    💰 ค่าจ้างแบ่งเท่าๆ กัน — แต่ละคนได้ {Math.floor((parseFloat(payAmount) * (isMentorship ? 0.85 : 0.9)) / requiredWorkers).toLocaleString()} TRPB
                    <br />
                    <span className="text-[10px] text-muted-foreground">
                      (หลังหักค่าธรรมเนียม: 5% กองทุน + 5% คณะทำงาน{isMentorship ? " + 5% mentor" : ""})
                    </span>
                  </p>
                )}
              </div>
            ) : (
              /* ACTIVITY mode — per-person pay + capacity + event date */
              <div className="space-y-3 pt-2 border-t">
                <div className="rounded-lg bg-amber-50 border border-amber-200 p-2 text-xs text-amber-900">
                  🎉 <strong>กิจกรรมหมู่</strong> — จ่ายรายคนแบบ fixed rate · check-in ด้วย QR · ไม่หารงบ
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label className="text-foreground">จำนวนผู้เข้าร่วม</Label>
                    <Input
                      type="number"
                      min={1}
                      max={100}
                      value={requiredWorkers}
                      onChange={(e) => setRequiredWorkers(parseInt(e.target.value) || 1)}
                    />
                    <p className="text-[10px] text-muted-foreground">1-100 คน</p>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-foreground">ค่าตอบแทน/คน (TRPB)</Label>
                    <Input
                      type="number"
                      min={1}
                      placeholder="50"
                      value={payPerPerson}
                      onChange={(e) => setPayPerPerson(e.target.value)}
                    />
                    <p className="text-[10px] text-muted-foreground">net ที่ นศ. ได้</p>
                  </div>
                </div>
                <div className="space-y-1">
                  <Label className="text-foreground">วันที่จัดกิจกรรม</Label>
                  <Input
                    type="date"
                    value={eventDate}
                    onChange={(e) => setEventDate(e.target.value)}
                  />
                </div>
                {requiredWorkers > 0 && payPerPerson && parseFloat(payPerPerson) > 0 && (
                  <div className="rounded-lg bg-emerald-50 border border-emerald-200 p-3 text-xs space-y-1">
                    <p className="font-semibold text-emerald-900">📊 สรุปงบประมาณ</p>
                    <p className="text-emerald-800">
                      Net per person: <strong>{Number(payPerPerson).toLocaleString()} TRPB</strong> × {requiredWorkers} คน
                    </p>
                    <p className="text-emerald-700">
                      Gross per person (รวมค่าธรรมเนียม 10%): {Math.ceil(parseFloat(payPerPerson) / 0.9).toLocaleString()} TRPB
                    </p>
                    <p className="text-emerald-700">
                      <strong>รวมงบประมาณ (สูงสุด): {(Math.ceil(parseFloat(payPerPerson) / 0.9) * requiredWorkers).toLocaleString()} TRPB</strong>
                    </p>
                    <p className="text-[10px] text-muted-foreground pt-1 border-t border-emerald-200">
                      💡 จ่ายจริงเฉพาะคนที่เข้าร่วม (CHECKED_IN → ATTENDED) · NO_SHOW ไม่ได้เงิน
                    </p>
                  </div>
                )}
                <p className="text-[10px] text-muted-foreground">
                  📌 รับสมัครแบบ FCFS (first-come-first-served auto-approve)
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        <Button type="submit" className="w-full" size="lg" disabled={loading}>
          {loading ? "กำลังบันทึก..." : "ลงประกาศงาน"}
        </Button>
      </form>
    </div>
  );
}
