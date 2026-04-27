"use client";

import { useState, useEffect, use } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";

const ROLE_LABELS: Record<string, string> = {
  employer: "ผู้ว่าจ้าง",
  student: "นักศึกษา",
  donor: "ผู้บริจาค",
  teacher: "อาจารย์",
};

export default function InviteRedeemPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = use(params);
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [invite, setInvite] = useState<any>(null);
  const [success, setSuccess] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  // Form state
  const [form, setForm] = useState({ name: "", email: "", phone: "", org: "" });

  useEffect(() => {
    fetch(`/api/invitations/${token}/redeem`)
      .then((r) => r.json())
      .then((data) => {
        if (data.valid) {
          setInvite(data);
          // Pre-fill from invitation
          setForm({
            name: data.prefilled?.name ?? "",
            email: data.prefilled?.email ?? "",
            phone: data.prefilled?.phone ?? "",
            org: data.prefilled?.org ?? "",
          });
        } else {
          setError(data.error ?? "คำเชิญไม่ถูกต้อง");
        }
      })
      .catch(() => setError("เกิดข้อผิดพลาด"))
      .finally(() => setLoading(false));
  }, [token]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name) {
      toast.error("กรุณากรอกชื่อ");
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch(`/api/invitations/${token}/redeem`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error ?? "ลงทะเบียนไม่สำเร็จ");
        return;
      }
      setSuccess(data);
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return <div className="flex min-h-screen items-center justify-center">กำลังโหลด...</div>;
  }

  if (error) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-muted px-4">
        <Card className="w-full max-w-md">
          <CardContent className="py-10 text-center">
            <div className="text-5xl mb-4">⚠️</div>
            <p className="text-lg font-medium">{error}</p>
            <p className="text-sm text-muted-foreground mt-2">
              กรุณาติดต่อเจ้าหน้าที่เพื่อขอคำเชิญใหม่
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Success — show PIN + QR (USER MUST SAVE)
  if (success) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-muted px-4 py-8">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center bg-green-50 rounded-t-lg">
            <div className="text-5xl mb-2">🎉</div>
            <CardTitle>ลงทะเบียนสำเร็จ!</CardTitle>
            <CardDescription>กรุณาบันทึก PIN และ QR ไว้ใช้ login ครั้งต่อไป</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 pt-6">
            <div className="bg-yellow-50 border border-yellow-200 p-4 rounded">
              <div className="text-sm font-medium mb-2">⚠️ สำคัญมาก: บันทึก PIN ก่อนปิดหน้านี้</div>
              <div className="text-3xl font-mono font-bold text-center bg-white p-3 rounded border tracking-widest">
                {success.pin}
              </div>
              <div className="text-xs text-muted-foreground mt-2">
                ถ้าลืม PIN ต้องติดต่อเจ้าหน้าที่ — ระบบไม่สามารถดึงกลับได้
              </div>
            </div>

            <div className="space-y-2">
              <div className="text-sm font-medium">QR Code สำหรับเข้าสู่ระบบ</div>
              <div className="bg-white p-4 rounded border flex justify-center">
                <img
                  src={`https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(success.qr_url)}`}
                  alt="Login QR"
                  className="size-48"
                />
              </div>
              <div className="text-xs text-center text-muted-foreground break-all">
                <code>{success.qr_url}</code>
              </div>
            </div>

            <Button
              className="w-full"
              size="lg"
              onClick={() => router.push("/")}
            >
              เข้าใช้งานเลย →
            </Button>

            <div className="text-xs text-center text-muted-foreground">
              เซสชั่นจะใช้ได้ 7 วัน — หลังจากนั้นต้องสแกน QR + PIN ใหม่
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Form
  return (
    <div className="flex min-h-screen items-center justify-center bg-muted px-4 py-8">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <CardTitle>ลงทะเบียน {ROLE_LABELS[invite?.intended_role] ?? invite?.intended_role}</CardTitle>
          <CardDescription>
            กรอกข้อมูลเพื่อสร้างบัญชีใน SkillChain
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="text-sm font-medium">ชื่อ-นามสกุล *</label>
              <Input
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                required
              />
            </div>
            <div>
              <label className="text-sm font-medium">เบอร์โทร</label>
              <Input
                type="tel"
                value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
              />
            </div>
            <div>
              <label className="text-sm font-medium">อีเมล (ถ้ามี)</label>
              <Input
                type="email"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
              />
            </div>
            <div>
              <label className="text-sm font-medium">หน่วยงาน/บริษัท</label>
              <Input
                value={form.org}
                onChange={(e) => setForm({ ...form, org: e.target.value })}
              />
            </div>

            <div className="text-xs text-muted-foreground p-3 bg-blue-50 rounded">
              💡 หลังลงทะเบียน ระบบจะสร้าง <strong>PIN 6 หลัก</strong> และ <strong>QR Code</strong> ส่วนตัวให้คุณ
              ใช้สำหรับเข้าสู่ระบบครั้งต่อไป
            </div>

            <Button type="submit" className="w-full" size="lg" disabled={submitting}>
              {submitting ? "กำลังสร้างบัญชี..." : "ลงทะเบียน"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
