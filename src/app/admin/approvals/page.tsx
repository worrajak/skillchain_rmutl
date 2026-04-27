"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";
import { CheckCircle, XCircle, Clock, UserCheck } from "lucide-react";
import { toast } from "sonner";

const ROLE_LABELS: Record<string, string> = {
  student: "นักศึกษา",
  employer: "ผู้ว่าจ้าง",
  teacher: "อาจารย์",
  project_staff: "คณะทำงานใต้ร่มฯ",
  rmutl_staff: "คณะทำงาน มทร.",
  donor: "ผู้บริจาค",
  admin: "แอดมิน",
  superadmin: "Super Admin",
};

interface PendingUser {
  id: string;
  name: string;
  email: string;
  role: string;
  campus: string;
  approval_status: string;
  created_at: string;
  student_id_card: string | null;
  faculty: string | null;
  organization: string | null;
  staff_position: string | null;
  teacher_id_card: string | null;
}

export default function AdminApprovalsPage() {
  const [pending, setPending] = useState<PendingUser[]>([]);
  const [all, setAll] = useState<PendingUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<"pending" | "all">("pending");

  const supabase = createClient();

  async function loadData() {
    setLoading(true);
    const [{ data: p }, { data: a }] = await Promise.all([
      supabase.from("skc_users").select("*").eq("approval_status", "PENDING").order("created_at", { ascending: false }),
      supabase.from("skc_users").select("*").order("created_at", { ascending: false }).limit(50),
    ]);
    setPending((p as PendingUser[]) ?? []);
    setAll((a as PendingUser[]) ?? []);
    setLoading(false);
  }

  useEffect(() => { loadData(); }, []);

  async function handleApprove(userId: string) {
    const res = await fetch(`/api/users/${userId}/approve`, { method: "POST" });
    const data = await res.json();
    if (res.ok) {
      const msg = data.wallet_generated
        ? `ยืนยันสำเร็จ — สร้าง Wallet: ${data.wallet_address}`
        : "ยืนยันสำเร็จ";
      toast.success(msg);
      loadData();
    } else {
      toast.error(data.error ?? "อนุมัติไม่สำเร็จ");
    }
  }

  async function handleReject(userId: string) {
    const reason = prompt("เหตุผลที่ปฏิเสธ:");
    if (reason === null) return;

    const { data: { user: me } } = await supabase.auth.getUser();
    const { error } = await supabase.from("skc_users").update({
      approval_status: "REJECTED",
      approved_by: me?.id,
      approved_at: new Date().toISOString(),
    }).eq("id", userId);

    if (!error) {
      await supabase.from("skc_approval_logs").insert({
        user_id: userId,
        approved_by: me?.id,
        action: "REJECTED",
        reason,
      });
      toast.success("ปฏิเสธแล้ว");
      loadData();
    }
  }

  async function handleSuspend(userId: string) {
    const { data: { user: me } } = await supabase.auth.getUser();
    await supabase.from("skc_users").update({ approval_status: "SUSPENDED", approved_by: me?.id }).eq("id", userId);
    await supabase.from("skc_approval_logs").insert({ user_id: userId, approved_by: me?.id, action: "SUSPENDED" });
    toast.success("ระงับแล้ว");
    loadData();
  }

  const statusBadge = (status: string) => {
    const map: Record<string, { label: string; color: string }> = {
      PENDING: { label: "รอยืนยัน", color: "bg-yellow-100 text-yellow-800" },
      APPROVED: { label: "ยืนยันแล้ว", color: "bg-green-100 text-green-800" },
      REJECTED: { label: "ปฏิเสธ", color: "bg-red-100 text-red-800" },
      SUSPENDED: { label: "ระงับ", color: "bg-gray-100 text-gray-800" },
    };
    const s = map[status] ?? { label: status, color: "bg-gray-100" };
    return <span className={cn("inline-flex rounded-full px-2 py-0.5 text-xs font-medium", s.color)}>{s.label}</span>;
  };

  const extraInfo = (u: PendingUser) => {
    const parts: string[] = [];
    if (u.student_id_card) parts.push(`รหัส: ${u.student_id_card}`);
    if (u.teacher_id_card) parts.push(`รหัสอจ.: ${u.teacher_id_card}`);
    if (u.faculty) parts.push(u.faculty);
    if (u.organization) parts.push(u.organization);
    if (u.staff_position) parts.push(u.staff_position);
    return parts.join(" · ") || "-";
  };

  const list = tab === "pending" ? pending : all;

  return (
    <div className="space-y-4">
      {/* Tab buttons */}
      <div className="flex gap-2">
        <Button variant={tab === "pending" ? "default" : "outline"} size="sm" onClick={() => setTab("pending")}>
          <Clock className="size-4 mr-1" /> รอยืนยัน ({pending.length})
        </Button>
        <Button variant={tab === "all" ? "default" : "outline"} size="sm" onClick={() => setTab("all")}>
          <UserCheck className="size-4 mr-1" /> ทั้งหมด
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-foreground">
            {tab === "pending" ? "ผู้ใช้รอยืนยัน" : "ผู้ใช้ทั้งหมด"} ({list.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex justify-center py-8">
              <div className="animate-spin size-6 border-4 border-blue-500 border-t-transparent rounded-full" />
            </div>
          ) : list.length > 0 ? (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>ชื่อ</TableHead>
                    <TableHead>อีเมล</TableHead>
                    <TableHead>บทบาท</TableHead>
                    <TableHead>ข้อมูลเพิ่มเติม</TableHead>
                    <TableHead>สถานะ</TableHead>
                    <TableHead>วันที่สมัคร</TableHead>
                    <TableHead className="text-right">จัดการ</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {list.map((u) => (
                    <TableRow key={u.id}>
                      <TableCell className="font-medium text-foreground">{u.name}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">{u.email}</TableCell>
                      <TableCell>
                        <span className="inline-flex rounded-full bg-blue-100 text-blue-800 px-2 py-0.5 text-xs font-medium">
                          {ROLE_LABELS[u.role] ?? u.role}
                        </span>
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground max-w-[200px] truncate">
                        {extraInfo(u)}
                      </TableCell>
                      <TableCell>{statusBadge(u.approval_status)}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {new Date(u.created_at).toLocaleDateString("th-TH")}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          {u.approval_status !== "APPROVED" && (
                            <Button size="sm" variant="ghost" className="text-green-600" onClick={() => handleApprove(u.id)}>
                              <CheckCircle className="size-4 mr-1" /> ยืนยัน
                            </Button>
                          )}
                          {u.approval_status === "PENDING" && (
                            <Button size="sm" variant="ghost" className="text-red-600" onClick={() => handleReject(u.id)}>
                              <XCircle className="size-4 mr-1" /> ปฏิเสธ
                            </Button>
                          )}
                          {u.approval_status === "APPROVED" && (
                            <Button size="sm" variant="ghost" className="text-gray-600" onClick={() => handleSuspend(u.id)}>
                              ระงับ
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          ) : (
            <p className="text-center text-muted-foreground py-8">
              {tab === "pending" ? "ไม่มีผู้ใช้รอยืนยัน" : "ไม่พบผู้ใช้"}
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
