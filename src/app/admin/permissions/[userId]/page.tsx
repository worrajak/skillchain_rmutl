"use client";

import { useEffect, useState, use } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { CheckCircle2, XCircle, Clock, ShieldCheck, ShieldX, RotateCcw, Shield } from "lucide-react";
import { PERMISSION_CATEGORIES } from "@/lib/permissions";
import { cn } from "@/lib/utils";
import Link from "next/link";
import { toast } from "sonner";

export default function AdminPermissionsPage({ params }: { params: Promise<{ userId: string }> }) {
  const { userId } = use(params);
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [actionPerm, setActionPerm] = useState<any>(null);
  const [actionType, setActionType] = useState<"GRANT" | "REVOKE" | null>(null);
  const [reason, setReason] = useState("");
  const [expiresAt, setExpiresAt] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function load() {
    setLoading(true);
    const res = await fetch(`/api/permissions/users/${userId}`);
    const d = await res.json();
    setData(d);
    setLoading(false);
  }

  useEffect(() => { load(); }, [userId]);

  async function handleAction() {
    if (!actionPerm || !actionType) return;
    setSubmitting(true);
    try {
      const res = await fetch(`/api/permissions/users/${userId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: actionType,
          permission: actionPerm.code,
          reason,
          expires_at: expiresAt || null,
        }),
      });
      const r = await res.json();
      if (!res.ok) {
        toast.error(r.error ?? "ดำเนินการไม่สำเร็จ");
        return;
      }
      toast.success(actionType === "GRANT" ? "มอบสิทธิ์แล้ว" : actionType === "REVOKE" ? "ถอนสิทธิ์แล้ว" : "รีเซ็ตเป็นค่าเริ่มต้น");
      setActionPerm(null);
      setActionType(null);
      setReason("");
      setExpiresAt("");
      load();
    } finally {
      setSubmitting(false);
    }
  }

  async function handleReset(perm: any) {
    if (!confirm(`รีเซ็ต "${perm.label_th}" เป็นค่าเริ่มต้นตาม role?`)) return;
    const res = await fetch(`/api/permissions/users/${userId}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "RESET", permission: perm.code }),
    });
    if (res.ok) {
      toast.success("รีเซ็ตเรียบร้อย");
      load();
    } else {
      toast.error("รีเซ็ตไม่สำเร็จ");
    }
  }

  if (loading) return <div className="p-8 text-center">กำลังโหลด...</div>;
  if (!data?.user) return <div className="p-8 text-center">ไม่พบผู้ใช้</div>;

  const grantedSet = new Set(data.effectivePermissions.map((p: any) => p.permission_code));
  const overrideMap = new Map(data.overrides.map((o: any) => [o.permission_code, o]));
  const sourceMap = new Map(data.effectivePermissions.map((p: any) => [p.permission_code, p]));

  // Group catalog
  const grouped: Record<string, any[]> = {};
  for (const c of data.catalog) {
    if (!grouped[c.category]) grouped[c.category] = [];
    grouped[c.category].push(c);
  }

  const sortedCategories = Object.entries(grouped).sort(
    ([a], [b]) => (PERMISSION_CATEGORIES[a]?.order ?? 99) - (PERMISSION_CATEGORIES[b]?.order ?? 99)
  );

  return (
    <div className="container max-w-5xl mx-auto py-6 px-4">
      <Link href="/admin/users" className="text-sm text-muted-foreground hover:underline mb-3 inline-block">
        ← กลับรายชื่อผู้ใช้
      </Link>

      <div className="mb-4">
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Shield className="size-7 text-blue-600" />
          จัดการสิทธิ์ — {data.user.name}
        </h1>
        <div className="text-sm text-muted-foreground mt-1">
          {data.user.email} · Role: <Badge variant="outline">{data.user.role}</Badge>
        </div>
      </div>

      <div className="mb-4 grid grid-cols-3 gap-3">
        <Card>
          <CardContent className="py-3 text-center">
            <div className="text-2xl font-bold text-green-600">{data.effectivePermissions.length}</div>
            <div className="text-xs text-muted-foreground">สิทธิ์รวม</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="py-3 text-center">
            <div className="text-2xl font-bold text-blue-600">
              {data.overrides.filter((o: any) => o.action === "GRANT").length}
            </div>
            <div className="text-xs text-muted-foreground">มอบเพิ่ม</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="py-3 text-center">
            <div className="text-2xl font-bold text-red-600">
              {data.overrides.filter((o: any) => o.action === "REVOKE").length}
            </div>
            <div className="text-xs text-muted-foreground">ถอนสิทธิ์</div>
          </CardContent>
        </Card>
      </div>

      {sortedCategories.map(([category, items]) => {
        const cat = PERMISSION_CATEGORIES[category];
        return (
          <Card key={category} className="mb-4">
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <span>{cat?.icon}</span> {cat?.label_th ?? category}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {items.map((item: any) => {
                const isGranted = grantedSet.has(item.code);
                const override = overrideMap.get(item.code) as any;
                const source = sourceMap.get(item.code) as any;

                return (
                  <div
                    key={item.code}
                    className={cn(
                      "flex items-start gap-3 p-3 rounded border",
                      isGranted ? "bg-green-50 border-green-200" : "bg-slate-50 border-slate-200"
                    )}
                  >
                    {isGranted ? (
                      <CheckCircle2 className="size-5 text-green-600 shrink-0 mt-0.5" />
                    ) : (
                      <XCircle className="size-5 text-slate-400 shrink-0 mt-0.5" />
                    )}

                    <div className="flex-1 min-w-0">
                      <div className="font-medium flex items-center gap-2 flex-wrap">
                        {item.label_th}
                        {item.is_dangerous && <Badge variant="destructive" className="text-[10px]">อันตราย</Badge>}
                        {source?.source === "granted" && (
                          <Badge className="text-[10px] bg-blue-600">มอบเพิ่ม</Badge>
                        )}
                        {override?.action === "REVOKE" && (
                          <Badge variant="destructive" className="text-[10px]">ถอนสิทธิ์</Badge>
                        )}
                        {source?.expires_at && (
                          <Badge variant="outline" className="text-[10px]">
                            <Clock className="size-3 mr-1" />
                            ถึง {new Date(source.expires_at).toLocaleDateString("th-TH")}
                          </Badge>
                        )}
                      </div>
                      {item.description_th && (
                        <div className="text-xs text-muted-foreground mt-0.5">{item.description_th}</div>
                      )}
                      <div className="text-[10px] text-muted-foreground/70 mt-0.5 font-mono">{item.code}</div>
                    </div>

                    <div className="flex flex-col gap-1 shrink-0">
                      {!isGranted && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => { setActionPerm(item); setActionType("GRANT"); }}
                        >
                          <ShieldCheck className="size-4 mr-1" /> มอบสิทธิ์
                        </Button>
                      )}
                      {isGranted && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => { setActionPerm(item); setActionType("REVOKE"); }}
                        >
                          <ShieldX className="size-4 mr-1" /> ถอนสิทธิ์
                        </Button>
                      )}
                      {override && (
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleReset(item)}
                        >
                          <RotateCcw className="size-4 mr-1" /> รีเซ็ต
                        </Button>
                      )}
                    </div>
                  </div>
                );
              })}
            </CardContent>
          </Card>
        );
      })}

      {/* Action dialog */}
      <Dialog open={!!actionPerm} onOpenChange={() => { setActionPerm(null); setActionType(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {actionType === "GRANT" ? "มอบสิทธิ์: " : "ถอนสิทธิ์: "}
              {actionPerm?.label_th}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            {actionPerm?.is_dangerous && (
              <div className="bg-red-50 border border-red-200 p-3 rounded text-sm">
                ⚠️ <strong>สิทธิ์นี้อันตราย</strong> — โปรดยืนยันก่อน{actionType === "GRANT" ? "มอบ" : "ถอน"}
              </div>
            )}
            <div>
              <Label>เหตุผล</Label>
              <Input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="เช่น มอบหมายให้ดูแลโครงการ A" />
            </div>
            <div>
              <Label>วันหมดอายุ (ไม่บังคับ)</Label>
              <Input type="date" value={expiresAt} onChange={(e) => setExpiresAt(e.target.value)} />
              <div className="text-xs text-muted-foreground mt-1">
                ปล่อยว่าง = ไม่หมดอายุ
              </div>
            </div>
            <div className="flex gap-2 justify-end">
              <Button variant="outline" onClick={() => { setActionPerm(null); setActionType(null); }}>
                ยกเลิก
              </Button>
              <Button onClick={handleAction} disabled={submitting}>
                {submitting ? "กำลังบันทึก..." : "ยืนยัน"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
