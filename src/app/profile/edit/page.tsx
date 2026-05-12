"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ArrowLeft, Loader2 } from "lucide-react";
import { AvatarUpload } from "@/components/avatar-upload";
import { toast } from "sonner";

interface ProfileForm {
  name: string;
  phone: string;
  faculty: string | null;
  year_level: number | null;
  student_id_card: string | null;
  organization: string | null;
  staff_position: string | null;
}

/**
 * Universal /profile/edit — works for every role.
 * Shows only the fields relevant to the user's role + the avatar upload.
 */
export default function ProfileEditPage() {
  const router = useRouter();
  const supabase = createClient();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const [role, setRole] = useState<string | null>(null);
  const [email, setEmail] = useState<string | null>(null);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [form, setForm] = useState<ProfileForm>({
    name: "",
    phone: "",
    faculty: null,
    year_level: null,
    student_id_card: null,
    organization: null,
    staff_position: null,
  });

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        router.push("/login");
        return;
      }
      setUserId(user.id);
      setEmail(user.email ?? null);

      const { data: profile } = await supabase
        .from("skc_users")
        .select("name, phone, role, avatar_url, faculty, year_level, student_id_card, organization, staff_position")
        .eq("id", user.id)
        .single();
      if (profile) {
        setRole(profile.role);
        setAvatarUrl(profile.avatar_url ?? null);
        setForm({
          name: profile.name ?? "",
          phone: profile.phone ?? "",
          faculty: profile.faculty ?? null,
          year_level: profile.year_level ?? null,
          student_id_card: profile.student_id_card ?? null,
          organization: profile.organization ?? null,
          staff_position: profile.staff_position ?? null,
        });
      }
      setLoading(false);
    }
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!userId) return;
    setSaving(true);
    try {
      const payload: Partial<ProfileForm> & { name: string } = {
        name: form.name.trim(),
        phone: form.phone.trim(),
      };
      if (role === "student") {
        payload.faculty = form.faculty;
        payload.year_level = form.year_level;
        payload.student_id_card = form.student_id_card;
      } else if (role === "employer") {
        payload.organization = form.organization;
      } else if (role === "project_staff" || role === "rmutl_staff") {
        payload.staff_position = form.staff_position;
      }
      const { error } = await supabase
        .from("skc_users")
        .update(payload)
        .eq("id", userId);
      if (error) throw error;
      toast.success("✅ บันทึกโปรไฟล์แล้ว");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "บันทึกไม่สำเร็จ");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="container max-w-md mx-auto p-6 text-center">
        <Loader2 className="size-6 mx-auto animate-spin text-sky-500" />
      </div>
    );
  }

  return (
    <div className="container max-w-md mx-auto px-4 py-6 space-y-4">
      <div className="flex items-center gap-2">
        <Link href="/profile">
          <Button variant="ghost" size="sm">
            <ArrowLeft className="size-4 mr-1" />
            กลับ
          </Button>
        </Link>
        <h1 className="text-xl font-bold">แก้ไขโปรไฟล์</h1>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>รูปโปรไฟล์</CardTitle>
          <CardDescription>กดเพื่อถ่ายรูปใหม่หรือเลือกจากคลังภาพ</CardDescription>
        </CardHeader>
        <CardContent>
          {userId && (
            <AvatarUpload
              userId={userId}
              currentUrl={avatarUrl}
              name={form.name || email || ""}
              role={role}
              size="xl"
              editable
              onUploaded={(url) => setAvatarUrl(url)}
            />
          )}
        </CardContent>
      </Card>

      <form onSubmit={save}>
        <Card>
          <CardHeader>
            <CardTitle>ข้อมูลส่วนตัว</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>อีเมล</Label>
              <Input value={email ?? ""} disabled className="bg-muted" />
              <p className="text-[11px] text-muted-foreground">อีเมลเปลี่ยนไม่ได้</p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="name">ชื่อ-นามสกุล</Label>
              <Input
                id="name"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="phone">เบอร์โทร</Label>
              <Input
                id="phone"
                type="tel"
                value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
                placeholder="08X-XXX-XXXX"
              />
            </div>

            {/* Role-specific fields */}
            {role === "student" && (
              <>
                <div className="space-y-2">
                  <Label htmlFor="student_id_card">รหัสนักศึกษา</Label>
                  <Input
                    id="student_id_card"
                    value={form.student_id_card ?? ""}
                    onChange={(e) => setForm({ ...form, student_id_card: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="faculty">คณะ/สาขาวิชา</Label>
                  <Input
                    id="faculty"
                    value={form.faculty ?? ""}
                    onChange={(e) => setForm({ ...form, faculty: e.target.value })}
                    placeholder="เช่น วิศวกรรมไฟฟ้า"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="year_level">ระดับชั้นปี</Label>
                  <Input
                    id="year_level"
                    type="number"
                    min={1}
                    max={5}
                    value={form.year_level ?? ""}
                    onChange={(e) =>
                      setForm({ ...form, year_level: e.target.value ? parseInt(e.target.value) : null })
                    }
                  />
                </div>
              </>
            )}

            {role === "employer" && (
              <div className="space-y-2">
                <Label htmlFor="organization">หน่วยงาน/บริษัท</Label>
                <Input
                  id="organization"
                  value={form.organization ?? ""}
                  onChange={(e) => setForm({ ...form, organization: e.target.value })}
                  placeholder="เช่น สำนักงานอธิการบดี มทร.ล้านนา"
                />
              </div>
            )}

            {(role === "project_staff" || role === "rmutl_staff") && (
              <div className="space-y-2">
                <Label htmlFor="staff_position">ตำแหน่ง</Label>
                <Input
                  id="staff_position"
                  value={form.staff_position ?? ""}
                  onChange={(e) => setForm({ ...form, staff_position: e.target.value })}
                  placeholder="เช่น หัวหน้าโครงการ"
                />
              </div>
            )}

            <Button type="submit" disabled={saving} className="w-full">
              {saving ? (
                <>
                  <Loader2 className="size-4 mr-1 animate-spin" />
                  กำลังบันทึก...
                </>
              ) : (
                "บันทึก"
              )}
            </Button>
          </CardContent>
        </Card>
      </form>
    </div>
  );
}
