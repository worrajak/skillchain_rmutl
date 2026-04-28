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

    const payload = {
      title,
      description,
      type: jobType,
      job_category: jobCategory,
      location,
      campus,
      pay_amount: parseFloat(payAmount) || 0,
      deadline: new Date(deadline).toISOString(),
      employer_id: userId,
      is_mentorship: isMentorship,
      status: "PENDING_REVIEW",
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
            {jobType === "PAID" && (
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
          </CardContent>
        </Card>

        <Button type="submit" className="w-full" size="lg" disabled={loading}>
          {loading ? "กำลังบันทึก..." : "ลงประกาศงาน"}
        </Button>
      </form>
    </div>
  );
}
