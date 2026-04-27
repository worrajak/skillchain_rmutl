"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { cn } from "@/lib/utils";
import {
  User,
  Mail,
  MapPin,
  Wallet,
  Award,
  Star,
  Shield,
  GraduationCap,
  Crown,
  UserCheck,
  Save,
  AlertTriangle,
} from "lucide-react";
import { toast } from "sonner";
import { AvatarUpload } from "@/components/avatar-upload";
import { TelegramLink } from "@/components/telegram-link";
import { getCampusLabel } from "@/types/database";

const CREDENTIAL_CONFIG: Record<string, { num: number; name: string; gradient: string; icon: typeof Award }> = {
  LEVEL_1: { num: 1, name: "ลงทะเบียน", gradient: "from-gray-400 to-gray-500", icon: UserCheck },
  LEVEL_2: { num: 2, name: "ผ่านฝึกอบรม", gradient: "from-amber-500 to-orange-600", icon: Shield },
  LEVEL_3: { num: 3, name: "อาจารย์รับรอง", gradient: "from-blue-500 to-indigo-600", icon: GraduationCap },
  LEVEL_4: { num: 4, name: "สถาบันชาติรับรอง", gradient: "from-yellow-400 to-amber-500", icon: Award },
  LEVEL_5: { num: 5, name: "ช่างชำนาญการ", gradient: "from-purple-500 to-fuchsia-600", icon: Crown },
};

export default function StudentProfilePage() {
  const [profile, setProfile] = useState<Record<string, unknown> | null>(null);
  const [credential, setCredential] = useState<Record<string, unknown> | null>(null);
  const [ratings, setRatings] = useState<Record<string, unknown> | null>(null);
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const supabase = createClient();

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setLoading(false); return; }

      const [{ data: prof }, { data: cred }, { data: rate }] = await Promise.all([
        supabase.from("skc_users").select("id, email, name, role, campus, faculty, year_level, student_id_card, wallet_address, avatar_url, approval_status, created_at").eq("id", user.id).single(),
        supabase.from("skc_student_credentials").select("*").eq("student_id", user.id).eq("is_active", true).order("credential_level", { ascending: false }).limit(1).single(),
        supabase.from("skc_student_rating_summary").select("*").eq("student_id", user.id).single(),
      ]);

      setProfile(prof);
      setCredential(cred);
      setRatings(rate);
      if (prof) setName(prof.name as string);
      setLoading(false);
    }
    load();
  }, []);

  async function handleSave() {
    if (!profile) return;
    setSaving(true);
    const { error } = await supabase.from("skc_users").update({ name }).eq("id", profile.id);
    setSaving(false);
    if (!error) {
      toast.success("บันทึกสำเร็จ");
      setProfile({ ...profile, name });
    } else {
      toast.error(error.message);
    }
  }

  if (loading) {
    return <div className="flex justify-center py-20"><div className="animate-spin size-8 border-4 border-blue-500 border-t-transparent rounded-full" /></div>;
  }

  if (!profile) {
    return (
      <Card className="max-w-md mx-auto mt-10 text-center">
        <CardContent className="py-10 space-y-4">
          <AlertTriangle className="size-12 mx-auto text-yellow-500" />
          <p className="font-medium text-foreground">กรุณาเข้าสู่ระบบ</p>
          <Link href="/login"><Button>เข้าสู่ระบบ</Button></Link>
        </CardContent>
      </Card>
    );
  }

  const credLevel = (credential?.credential_level as string) ?? "LEVEL_1";
  const credConfig = CREDENTIAL_CONFIG[credLevel] ?? CREDENTIAL_CONFIG.LEVEL_1;
  const CredIcon = credConfig.icon;

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      {/* Credential Card */}
      <Card className={cn("overflow-hidden text-white bg-gradient-to-br", credConfig.gradient)}>
        <CardContent className="relative py-6">
          <div className="absolute inset-0 opacity-10">
            <div className="absolute -right-6 -top-6 size-24 rounded-full border-4 border-white" />
            <div className="absolute -left-4 -bottom-4 size-32 rounded-full border-4 border-white" />
          </div>
          <div className="relative flex items-center gap-4">
            <AvatarUpload
              userId={profile.id as string}
              currentUrl={profile.avatar_url as string | null}
              name={profile.name as string}
              size="lg"
              editable
              onUploaded={(url) => setProfile({ ...profile, avatar_url: url })}
            />
            <div>
              <div className="font-bold text-2xl">Level {credConfig.num}</div>
              <div className="text-lg opacity-90">{credConfig.name}</div>
              {credential?.specialization ? (
                <div className="text-sm opacity-80 mt-1">สาขา: {String(credential.specialization)}</div>
              ) : null}
              {credential?.certificate_ref ? (
                <div className="text-sm opacity-80">เลขที่: {String(credential.certificate_ref)}</div>
              ) : null}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Rating Summary */}
      {ratings && Number(ratings.combined_score) > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-foreground flex items-center gap-2"><Star className="size-5 text-yellow-500" />คะแนนประเมินรวม</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-6">
              <div className="text-center">
                <div className="text-4xl font-bold text-foreground">{Number(ratings.combined_score).toFixed(1)}</div>
                <div className="text-xs text-muted-foreground">คะแนนรวม</div>
              </div>
              <div className="flex-1 grid grid-cols-3 gap-3 text-center text-xs">
                <div className="rounded-lg bg-blue-50 p-3">
                  <div className="font-bold text-blue-700 text-lg">{Number(ratings.avg_teacher_score).toFixed(1)}</div>
                  <div className="text-muted-foreground">อาจารย์ ({String(ratings.teacher_review_count)})</div>
                </div>
                <div className="rounded-lg bg-green-50 p-3">
                  <div className="font-bold text-green-700 text-lg">{Number(ratings.avg_employer_rating).toFixed(1)}</div>
                  <div className="text-muted-foreground">ผู้จ้าง ({String(ratings.employer_review_count)})</div>
                </div>
                <div className="rounded-lg bg-purple-50 p-3">
                  <div className="font-bold text-purple-700 text-lg">{Number(ratings.avg_mentor_score).toFixed(1)}</div>
                  <div className="text-muted-foreground">พี่เลี้ยง ({String(ratings.mentor_review_count)})</div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Telegram */}
      <TelegramLink />

      {/* Profile Form */}
      <Card>
        <CardHeader>
          <CardTitle className="text-foreground flex items-center gap-2"><User className="size-5" />ข้อมูลส่วนตัว</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label className="text-foreground">ชื่อ-นามสกุล</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label className="text-foreground">อีเมล</Label>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Mail className="size-4" />{profile.email as string}
            </div>
          </div>
          <div className="space-y-2">
            <Label className="text-foreground">วิทยาเขต</Label>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <MapPin className="size-4" />{getCampusLabel(profile.campus as string)}
            </div>
          </div>
          <div className="space-y-2">
            <Label className="text-foreground">Wallet</Label>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Wallet className="size-4" />{(profile.wallet_address as string) ?? "ยังไม่ได้เชื่อมต่อ"}
            </div>
          </div>
          <Button onClick={handleSave} disabled={saving} className="w-full">
            <Save className="size-4 mr-2" />
            {saving ? "กำลังบันทึก..." : "บันทึก"}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
