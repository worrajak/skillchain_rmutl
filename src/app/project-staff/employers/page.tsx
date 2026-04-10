"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { Users, Search, Wallet, Save } from "lucide-react";
import { toast } from "sonner";

interface Employer {
  id: string;
  name: string;
  email: string;
  organization: string | null;
  job_quota: number;
  job_quota_used: number;
  approval_status: string;
}

export default function StaffEmployersPage() {
  const [employers, setEmployers] = useState<Employer[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [editing, setEditing] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState<string | null>(null);
  const supabase = createClient();

  async function loadEmployers() {
    setLoading(true);
    const { data } = await supabase
      .from("users")
      .select("id, name, email, organization, job_quota, job_quota_used, approval_status")
      .eq("role", "employer")
      .eq("approval_status", "APPROVED")
      .order("name");
    setEmployers((data as Employer[]) ?? []);
    setLoading(false);
  }

  useEffect(() => { loadEmployers(); }, []);

  const filtered = employers.filter((e) => {
    if (!search) return true;
    return e.name.toLowerCase().includes(search.toLowerCase()) || e.email.toLowerCase().includes(search.toLowerCase());
  });

  async function handleSaveQuota(employer: Employer) {
    const newQuota = parseInt(editing[employer.id] ?? String(employer.job_quota)) || 0;
    setSaving(employer.id);
    const res = await fetch(`/api/employers/${employer.id}/quota`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ job_quota: newQuota }),
    });
    const data = await res.json();
    setSaving(null);
    if (res.ok) {
      toast.success(`ตั้งโควต้า ${employer.name} = ${newQuota} ครั้ง`);
      setEditing((prev) => { const n = { ...prev }; delete n[employer.id]; return n; });
      loadEmployers();
    } else {
      toast.error(data.error);
    }
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="pt-4 pb-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
            <Input placeholder="ค้นหาผู้ว่าจ้าง..." className="pl-9" value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-foreground flex items-center gap-2">
            <Users className="size-5" />โควต้าผู้ว่าจ้าง ({filtered.length})
          </CardTitle>
          <p className="text-xs text-muted-foreground">กำหนดจำนวนครั้งที่ผู้ว่าจ้างสามารถจ้างงาน PAID ได้ฟรี (ค่าจ้างหักจากกองทุนกลาง)</p>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex justify-center py-8"><div className="animate-spin size-6 border-4 border-green-500 border-t-transparent rounded-full" /></div>
          ) : filtered.length > 0 ? (
            <div className="space-y-3">
              {filtered.map((emp) => {
                const remaining = Math.max(0, emp.job_quota - emp.job_quota_used);
                const isEditing = editing[emp.id] !== undefined;
                return (
                  <div key={emp.id} className="flex items-center justify-between rounded-lg border p-3 gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-sm text-foreground truncate">{emp.name}</div>
                      <div className="text-xs text-muted-foreground truncate">{emp.email}{emp.organization ? ` · ${emp.organization}` : ""}</div>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="flex items-center gap-1">
                        <Wallet className="size-3 text-green-600" />
                        <span className="text-xs text-muted-foreground">ใช้ {emp.job_quota_used}/</span>
                        <Input
                          type="number"
                          min="0"
                          value={editing[emp.id] ?? String(emp.job_quota)}
                          onChange={(e) => setEditing((prev) => ({ ...prev, [emp.id]: e.target.value }))}
                          className="w-16 h-7 text-sm text-center"
                        />
                      </div>
                      {emp.job_quota > 0 && (
                        <span className={cn("text-xs font-medium px-1.5 py-0.5 rounded", remaining > 0 ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700")}>
                          เหลือ {remaining}
                        </span>
                      )}
                      {isEditing && (
                        <Button size="sm" className="h-7" onClick={() => handleSaveQuota(emp)} disabled={saving === emp.id}>
                          <Save className="size-3 mr-1" />{saving === emp.id ? "..." : "บันทึก"}
                        </Button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="text-center text-muted-foreground py-8">ไม่พบผู้ว่าจ้าง</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
