"use client";

import { useState, useEffect, use } from "react";
import { useRouter } from "next/navigation";
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
import { ArrowLeft, AlertTriangle, Save, Camera } from "lucide-react";
import { toast } from "sonner";
import { ImageUpload } from "@/components/image-upload";

const EDITABLE_STATUSES = ["PENDING_REVIEW", "OPEN", "ASSIGNED"];

export default function EditJobPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const supabase = createClient();

  const [job, setJob] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

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

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.push("/login"); return; }

      const { data: profile } = await supabase.from("skc_users").select("role").eq("id", user.id).single();
      const isStaffOrAdmin = profile && ["admin", "superadmin", "rmutl_staff", "project_staff"].includes(profile.role);

      const { data, error } = await supabase
        .from("skc_jobs")
        .select("*")
        .eq("id", id)
        .single();

      if (error || !data) { toast.error("ไม่พบงาน"); router.push("/employer/jobs"); return; }

      // Permission: must be employer or staff/admin
      if (data.employer_id !== user.id && !isStaffOrAdmin) {
        toast.error("ไม่มีสิทธิ์แก้ไขงานนี้");
        router.push(`/employer/jobs/${id}`);
        return;
      }

      // Status check
      if (!EDITABLE_STATUSES.includes(data.status)) {
        toast.error(`ไม่สามารถแก้ไขงานในสถานะ ${data.status} ได้`);
        router.push(`/employer/jobs/${id}`);
        return;
      }

      setJob(data);
      setTitle(data.title);
      setDescription(data.description);
      setJobType(data.type);
      setJobCategory(data.job_category);
      setLocation(data.location);
      setCampus(data.campus);
      setPayAmount(String(data.pay_amount ?? ""));
      setDeadline(data.deadline ? new Date(data.deadline).toISOString().slice(0, 10) : "");
      setIsMentorship(!!data.is_mentorship);
      setLoading(false);
    }
    load();
  }, [id]);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);

    const { error } = await supabase
      .from("skc_jobs")
      .update({
        title,
        description,
        type: jobType,
        job_category: jobCategory,
        location,
        campus,
        pay_amount: parseFloat(payAmount) || 0,
        deadline: new Date(deadline).toISOString(),
        is_mentorship: isMentorship,
      })
      .eq("id", id);

    setSaving(false);
    if (error) {
      toast.error("บันทึกไม่สำเร็จ: " + error.message);
      return;
    }
    toast.success("บันทึกการแก้ไขเรียบร้อย");
    router.push(`/employer/jobs/${id}`);
  }

  if (loading) return <div className="p-8 text-center">กำลังโหลด...</div>;
  if (!job) return null;

  return (
    <div className="max-w-2xl mx-auto space-y-4 p-4">
      <Link href={`/employer/jobs/${id}`} className="text-sm text-muted-foreground hover:underline inline-flex items-center gap-1">
        <ArrowLeft className="size-4" /> กลับ
      </Link>

      <div>
        <h1 className="text-2xl font-bold text-foreground">แก้ไขงาน</h1>
        <p className="text-sm text-muted-foreground mt-1">
          สถานะงาน: <strong>{job.status}</strong> — แก้ไขได้จนกว่าจะมี นศ. มารับงาน
        </p>
      </div>

      <form onSubmit={handleSave} className="space-y-4">
        <Card>
          <CardHeader><CardTitle className="text-foreground">รายละเอียดงาน</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label className="text-foreground">ชื่องาน</Label>
              <Input value={title} onChange={(e) => setTitle(e.target.value)} required />
            </div>
            <div className="space-y-2">
              <Label className="text-foreground">รายละเอียด</Label>
              <Textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={4} required />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label className="text-foreground">ประเภทงาน</Label>
                <Select value={jobType} onValueChange={(v) => v && setJobType(v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="PAID">งานจ้าง (PAID)</SelectItem>
                    <SelectItem value="VOLUNTEER">จิตอาสา</SelectItem>
                    <SelectItem value="TRAINING">ฝึกทักษะ</SelectItem>
                    <SelectItem value="EXEMPTED">ยกเว้นค่าบริการ</SelectItem>
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
              <Input value={location} onChange={(e) => setLocation(e.target.value)} required />
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
                <Input type="number" value={payAmount} onChange={(e) => setPayAmount(e.target.value)} min="0" />
              </div>
            )}
            <label className="flex items-center gap-3 cursor-pointer">
              <input type="checkbox" checked={isMentorship} onChange={(e) => setIsMentorship(e.target.checked)} className="size-4 rounded" />
              <div>
                <div className="text-sm font-medium text-foreground">งานนี้ต้องมี Mentor</div>
              </div>
            </label>
          </CardContent>
        </Card>

        {/* Image Upload */}
        <Card>
          <CardHeader>
            <CardTitle className="text-foreground text-base flex items-center gap-2">
              <Camera className="size-5 text-blue-600" />
              รูปเครื่อง/ลักษณะงาน (2-4 รูป)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ImageUpload jobId={id} imageType="job" maxImages={4} />
          </CardContent>
        </Card>

        <div className="flex gap-3">
          <Button type="submit" className="flex-1" size="lg" disabled={saving}>
            <Save className="size-4 mr-1" />
            {saving ? "กำลังบันทึก..." : "บันทึกการแก้ไข"}
          </Button>
          <Link href={`/employer/jobs/${id}`}>
            <Button type="button" variant="outline" size="lg">ยกเลิก</Button>
          </Link>
        </div>
      </form>
    </div>
  );
}
