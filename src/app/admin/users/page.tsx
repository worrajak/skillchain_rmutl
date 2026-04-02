"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Search, Edit2, Trash2, UserPlus, Shield } from "lucide-react";
import { toast } from "sonner";

interface User {
  id: string;
  email: string;
  name: string;
  role: string;
  campus: string;
  is_active: boolean;
  created_at: string;
  wallet_address: string | null;
}

const ROLES = [
  { value: "student", label: "นักศึกษา" },
  { value: "employer", label: "ผู้ว่าจ้าง" },
  { value: "teacher", label: "อาจารย์" },
  { value: "project_staff", label: "คณะทำงานใต้ร่มฯ" },
  { value: "rmutl_staff", label: "คณะทำงาน มทร." },
  { value: "donor", label: "ผู้บริจาค" },
  { value: "admin", label: "แอดมิน" },
  { value: "superadmin", label: "Super Admin" },
];

const CAMPUSES = [
  { value: "huaykaew", label: "ห้วยแก้ว" },
  { value: "doisaket", label: "ดอยสะเก็ด" },
];

export default function AdminUsersPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filterRole, setFilterRole] = useState("all");
  const [editUser, setEditUser] = useState<User | null>(null);
  const [editOpen, setEditOpen] = useState(false);

  const supabase = createClient();

  async function loadUsers() {
    setLoading(true);
    let query = supabase
      .from("users")
      .select("*")
      .order("created_at", { ascending: false });

    if (filterRole !== "all") {
      query = query.eq("role", filterRole);
    }
    if (search) {
      query = query.or(`name.ilike.%${search}%,email.ilike.%${search}%`);
    }

    const { data } = await query;
    setUsers(data ?? []);
    setLoading(false);
  }

  useEffect(() => { loadUsers(); }, [filterRole, search]);

  async function handleUpdateUser() {
    if (!editUser) return;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const u = editUser as any;
    const { error } = await supabase
      .from("users")
      .update({
        name: editUser.name,
        role: editUser.role,
        campus: editUser.campus,
        is_active: editUser.is_active,
        can_post_jobs: u.can_post_jobs ?? false,
        can_evaluate: u.can_evaluate ?? false,
        can_approve_users: u.can_approve_users ?? false,
        can_manage_credentials: u.can_manage_credentials ?? false,
      })
      .eq("id", editUser.id);

    if (error) {
      toast.error("อัปเดตไม่สำเร็จ: " + error.message);
    } else {
      toast.success("อัปเดตสำเร็จ");
      setEditOpen(false);
      loadUsers();
    }
  }

  async function handleToggleActive(user: User) {
    const { error } = await supabase
      .from("users")
      .update({ is_active: !user.is_active })
      .eq("id", user.id);

    if (!error) {
      toast.success(user.is_active ? "ระงับผู้ใช้แล้ว" : "เปิดใช้งานแล้ว");
      loadUsers();
    }
  }

  async function handleDelete(user: User) {
    if (!confirm(`ต้องการลบ "${user.name}" จริงหรือไม่?`)) return;
    const { error } = await supabase.from("users").delete().eq("id", user.id);
    if (!error) {
      toast.success("ลบสำเร็จ");
      loadUsers();
    } else {
      toast.error("ลบไม่สำเร็จ: " + error.message);
    }
  }

  const roleLabel = (role: string) => ROLES.find((r) => r.value === role)?.label ?? role;

  return (
    <div className="space-y-4">
      {/* Filters */}
      <Card>
        <CardContent className="flex flex-wrap gap-3 pt-4 pb-4">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
            <Input
              placeholder="ค้นหาชื่อหรืออีเมล..."
              className="pl-9"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <Select value={filterRole} onValueChange={(v) => v && setFilterRole(v)}>
            <SelectTrigger className="w-[160px]">
              <SelectValue placeholder="ทุก Role" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">ทุก Role</SelectItem>
              {ROLES.map((r) => (
                <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      {/* Users Table */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-foreground">
              ผู้ใช้งาน ({users.length})
            </CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex justify-center py-8">
              <div className="animate-spin size-6 border-4 border-blue-500 border-t-transparent rounded-full" />
            </div>
          ) : users.length > 0 ? (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>ชื่อ</TableHead>
                    <TableHead>อีเมล</TableHead>
                    <TableHead>บทบาท</TableHead>
                    <TableHead>วิทยาเขต</TableHead>
                    <TableHead>สถานะ</TableHead>
                    <TableHead>วันที่สมัคร</TableHead>
                    <TableHead className="text-right">จัดการ</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {users.map((user) => (
                    <TableRow key={user.id}>
                      <TableCell className="font-medium text-foreground">
                        {user.name}
                      </TableCell>
                      <TableCell className="text-muted-foreground text-xs">
                        {user.email}
                      </TableCell>
                      <TableCell>
                        <span className="inline-flex items-center gap-1 rounded-full bg-blue-100 text-blue-800 px-2 py-0.5 text-xs font-medium">
                          {user.role === "admin" || user.role === "superadmin" ? (
                            <Shield className="size-3" />
                          ) : null}
                          {roleLabel(user.role)}
                        </span>
                      </TableCell>
                      <TableCell className="text-sm">{user.campus}</TableCell>
                      <TableCell>
                        <span
                          className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${
                            user.is_active
                              ? "bg-green-100 text-green-800"
                              : "bg-red-100 text-red-800"
                          }`}
                        >
                          {user.is_active ? "ใช้งาน" : "ระงับ"}
                        </span>
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {new Date(user.created_at).toLocaleDateString("th-TH")}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => { setEditUser({ ...user }); setEditOpen(true); }}
                          >
                            <Edit2 className="size-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleToggleActive(user)}
                          >
                            {user.is_active ? "ระงับ" : "เปิด"}
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-red-600"
                            onClick={() => handleDelete(user)}
                          >
                            <Trash2 className="size-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          ) : (
            <p className="text-center text-muted-foreground py-8">ไม่พบผู้ใช้</p>
          )}
        </CardContent>
      </Card>

      {/* Edit Dialog */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="text-foreground">แก้ไขผู้ใช้</DialogTitle>
          </DialogHeader>
          {editUser && (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label className="text-foreground">ชื่อ</Label>
                <Input
                  value={editUser.name}
                  onChange={(e) => setEditUser({ ...editUser, name: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label className="text-foreground">อีเมล</Label>
                <Input value={editUser.email} disabled className="opacity-60" />
              </div>
              <div className="space-y-2">
                <Label className="text-foreground">บทบาท</Label>
                <Select
                  value={editUser.role}
                  onValueChange={(v) => v && setEditUser({ ...editUser, role: v })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {ROLES.map((r) => (
                      <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label className="text-foreground">วิทยาเขต</Label>
                <Select
                  value={editUser.campus}
                  onValueChange={(v) => v && setEditUser({ ...editUser, campus: v })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {CAMPUSES.map((c) => (
                      <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              {/* สิทธิ์เพิ่มเติม */}
              <div className="space-y-2">
                <Label className="text-foreground">สิทธิ์เพิ่มเติม (นอกเหนือ role หลัก)</Label>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { key: "can_post_jobs", label: "สร้างงาน/จ้างงาน" },
                    { key: "can_evaluate", label: "ประเมิน นศ." },
                    { key: "can_approve_users", label: "ยืนยันผู้ใช้" },
                    { key: "can_manage_credentials", label: "จัดการ Credential" },
                  ].map((perm) => (
                    <label key={perm.key} className="flex items-center gap-2 rounded-md border p-2 cursor-pointer hover:bg-muted text-sm">
                      <input
                        type="checkbox"
                        className="size-4 rounded"
                        checked={!!((editUser as any)[perm.key])}
                        onChange={(e) => setEditUser({ ...editUser, [perm.key]: e.target.checked } as any)}
                      />
                      <span className="text-foreground">{perm.label}</span>
                    </label>
                  ))}
                </div>
              </div>
              <div className="flex gap-3 pt-2">
                <Button onClick={handleUpdateUser} className="flex-1">
                  บันทึก
                </Button>
                <Button variant="outline" onClick={() => setEditOpen(false)}>
                  ยกเลิก
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
