"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Wallet, Loader2, Save, X, Search, AlertCircle, ExternalLink, Coins,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

const ROLE_COLORS: Record<string, string> = {
  superadmin: "bg-red-100 text-red-800",
  admin: "bg-red-100 text-red-800",
  project_staff: "bg-purple-100 text-purple-800",
  rmutl_staff: "bg-purple-100 text-purple-800",
  teacher: "bg-blue-100 text-blue-800",
  employer: "bg-green-100 text-green-800",
  student: "bg-cyan-100 text-cyan-800",
  donor: "bg-pink-100 text-pink-800",
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyRow = any;

export default function AdminWalletsPage() {
  const [data, setData] = useState<AnyRow>(null);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState("");
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState("");
  const [filterRole, setFilterRole] = useState<string>("all");
  const [filterWallet, setFilterWallet] = useState<"all" | "with" | "without">("all");

  const load = useCallback(async () => {
    setLoading(true);
    const res = await fetch("/api/admin/wallets");
    if (res.ok) setData(await res.json());
    else {
      const err = await res.json();
      toast.error(err.error || "โหลดข้อมูลไม่สำเร็จ");
    }
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  function startEdit(userId: string, current: string | null) {
    setEditingId(userId);
    setEditValue(current ?? "");
  }

  function cancelEdit() {
    setEditingId(null);
    setEditValue("");
  }

  async function saveWallet(userId: string) {
    const trimmed = editValue.trim();
    setSaving(true);
    const res = await fetch("/api/admin/wallets", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        user_id: userId,
        wallet_address: trimmed === "" ? null : trimmed,
      }),
    });
    const result = await res.json();
    setSaving(false);

    if (res.ok) {
      toast.success(result.message);
      cancelEdit();
      load();
    } else {
      toast.error(result.error || "บันทึกไม่สำเร็จ", { duration: 8000 });
    }
  }

  // Build role list dynamically + filter
  const filtered = useMemo(() => {
    if (!data?.users) return [];
    let list = data.users as AnyRow[];
    if (filterRole !== "all") list = list.filter((u) => u.role === filterRole);
    if (filterWallet === "with") list = list.filter((u) => u.has_wallet);
    if (filterWallet === "without") list = list.filter((u) => !u.has_wallet);
    if (search) {
      const q = search.toLowerCase();
      list = list.filter(
        (u) =>
          u.name?.toLowerCase().includes(q) ||
          u.email?.toLowerCase().includes(q) ||
          u.wallet_address?.toLowerCase().includes(q),
      );
    }
    return list;
  }, [data, filterRole, filterWallet, search]);

  const allRoles = useMemo(() => {
    if (!data?.users) return [];
    return [...new Set((data.users as AnyRow[]).map((u) => u.role))].sort();
  }, [data]);

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <Loader2 className="size-8 animate-spin text-blue-500" />
      </div>
    );
  }

  if (!data) return null;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Wallet className="size-8 text-blue-600" />
        <div>
          <h1 className="text-2xl font-bold">จัดการ Wallet (TRON Nile testnet)</h1>
          <p className="text-sm text-muted-foreground">
            ผูก/แก้ไข TRON wallet address ให้ผู้ใช้ — ใช้สำหรับ mirror TRPB on-chain เท่านั้น
          </p>
        </div>
      </div>

      <Card className="bg-amber-50 border-amber-200">
        <CardContent className="py-3 text-sm flex items-start gap-2">
          <AlertCircle className="size-4 text-amber-600 shrink-0 mt-0.5" />
          <div className="text-amber-900">
            <strong>หมายเหตุสำคัญ:</strong> wallet ทั้งหมดอยู่บน <strong>TRON Nile testnet</strong> —
            ใช้สำหรับทดสอบและเก็บ audit trail เท่านั้น <em>ไม่สามารถแลกเป็นเงินจริง</em>
            <br />
            <span className="text-xs">รูปแบบที่ถูกต้อง: ขึ้นต้นด้วย <code>T</code> + 33 ตัวอักษร/ตัวเลข (เช่น <code>T9yD14Nj9j7xAB4dbGeiX9h8unkKHxuWwb</code>)</span>
          </div>
        </CardContent>
      </Card>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3">
        <Card>
          <CardContent className="py-4 text-center">
            <div className="text-2xl font-bold text-foreground">{data.summary.total}</div>
            <div className="text-xs text-muted-foreground">ผู้ใช้ทั้งหมด</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="py-4 text-center">
            <div className="text-2xl font-bold text-green-600">{data.summary.with_wallet}</div>
            <div className="text-xs text-muted-foreground">มี wallet แล้ว</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="py-4 text-center">
            <div className="text-2xl font-bold text-orange-600">{data.summary.without_wallet}</div>
            <div className="text-xs text-muted-foreground">ยังไม่มี wallet</div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-2 items-center">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
          <Input
            placeholder="ค้นหา ชื่อ / email / wallet..."
            className="pl-9"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <select
          value={filterRole}
          onChange={(e) => setFilterRole(e.target.value)}
          className="border rounded-md px-3 py-2 text-sm bg-white"
        >
          <option value="all">ทุก role</option>
          {allRoles.map((r: string) => (
            <option key={r} value={r}>{r}</option>
          ))}
        </select>
        <div className="flex gap-1 border rounded-md overflow-hidden">
          {(["all", "with", "without"] as const).map((k) => (
            <button
              key={k}
              onClick={() => setFilterWallet(k)}
              className={cn(
                "px-3 py-2 text-sm transition-colors",
                filterWallet === k
                  ? "bg-blue-600 text-white"
                  : "bg-white text-foreground hover:bg-muted",
              )}
            >
              {k === "all" ? "ทุกคน" : k === "with" ? "มี wallet" : "ไม่มี"}
            </button>
          ))}
        </div>
      </div>

      {/* User list */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">รายชื่อผู้ใช้ ({filtered.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {filtered.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-6">
              ไม่พบผู้ใช้ในเงื่อนไขนี้
            </p>
          ) : (
            <div className="space-y-2">
              {filtered.map((u: AnyRow) => {
                const isEditing = editingId === u.id;
                return (
                  <div
                    key={u.id}
                    className={cn(
                      "rounded-lg border p-3 space-y-2",
                      !u.has_wallet && "bg-orange-50/30 border-orange-200",
                    )}
                  >
                    {/* Header: name + role + balance */}
                    <div className="flex items-start justify-between gap-3 flex-wrap">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-medium text-foreground">{u.name}</span>
                          <Badge className={cn(ROLE_COLORS[u.role] ?? "bg-gray-100", "text-[10px]")}>
                            {u.role}
                          </Badge>
                          {u.organization && (
                            <span className="text-xs text-muted-foreground">· {u.organization}</span>
                          )}
                        </div>
                        <div className="text-xs text-muted-foreground mt-0.5">{u.email}</div>
                      </div>
                      <div className="text-right text-xs shrink-0 inline-flex items-center gap-1">
                        <Coins className="size-3 text-yellow-600" />
                        <span className="font-semibold text-foreground">
                          {u.balance.toLocaleString()}
                        </span>
                        <span className="text-muted-foreground">TRPB</span>
                      </div>
                    </div>

                    {/* Wallet row */}
                    {isEditing ? (
                      <div className="flex gap-2 items-center pt-1 border-t">
                        <Input
                          value={editValue}
                          onChange={(e) => setEditValue(e.target.value)}
                          placeholder="T... (TRON Nile address — ปล่อยว่างเพื่อลบ)"
                          className="font-mono text-xs"
                          autoFocus
                        />
                        <Button
                          size="sm"
                          onClick={() => saveWallet(u.id)}
                          disabled={saving}
                          className="bg-green-600 hover:bg-green-700"
                        >
                          {saving ? (
                            <Loader2 className="size-3 animate-spin" />
                          ) : (
                            <Save className="size-3" />
                          )}
                        </Button>
                        <Button size="sm" variant="ghost" onClick={cancelEdit}>
                          <X className="size-3" />
                        </Button>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2 pt-1 border-t">
                        <Wallet className="size-3 text-muted-foreground shrink-0" />
                        {u.wallet_address ? (
                          <>
                            <code className="text-xs font-mono text-foreground flex-1 truncate">
                              {u.wallet_address}
                            </code>
                            <a
                              href={`https://nile.tronscan.org/#/address/${u.wallet_address}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-xs text-blue-600 hover:underline inline-flex items-center gap-0.5 shrink-0"
                            >
                              <ExternalLink className="size-3" /> TronScan
                            </a>
                          </>
                        ) : (
                          <span className="text-xs text-orange-700 italic flex-1">
                            ยังไม่มี wallet
                          </span>
                        )}
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-7 text-xs shrink-0"
                          onClick={() => startEdit(u.id, u.wallet_address)}
                        >
                          {u.wallet_address ? "แก้ไข" : "เพิ่ม wallet"}
                        </Button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
