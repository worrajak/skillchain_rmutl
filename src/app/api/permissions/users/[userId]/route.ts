import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  getUserPermissions,
  loadPermissionCatalog,
  grantPermission,
  revokePermission,
  resetToRoleDefault,
  hasPermission,
  PERMISSIONS,
  type PermissionCode,
} from "@/lib/permissions";
import { notifyAdmin } from "@/lib/telegram";

// GET /api/permissions/users/[userId]
// Admin views target user's effective permissions + overrides
export async function GET(_request: NextRequest, { params }: { params: Promise<{ userId: string }> }) {
  const { userId } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // Self or admin
  if (user.id !== userId) {
    const canManage = await hasPermission(supabase, user.id, PERMISSIONS.MANAGE_PERMISSIONS)
      || await hasPermission(supabase, user.id, PERMISSIONS.MANAGE_USERS);
    if (!canManage) {
      return NextResponse.json({ error: "ไม่มีสิทธิ์" }, { status: 403 });
    }
  }

  const [permissions, catalog, profileResult, overridesResult] = await Promise.all([
    getUserPermissions(supabase, userId),
    loadPermissionCatalog(supabase),
    supabase.from("skc_users").select("id, name, email, role").eq("id", userId).single(),
    supabase
      .from("skc_user_permission_overrides")
      .select("*, granted_by_user:skc_users!skc_user_permission_overrides_granted_by_fkey(name)")
      .eq("user_id", userId)
      .eq("is_active", true)
      .order("created_at", { ascending: false }),
  ]);

  return NextResponse.json({
    user: profileResult.data,
    effectivePermissions: permissions,
    overrides: overridesResult.data || [],
    catalog,
  });
}

// POST /api/permissions/users/[userId]
// Admin grants/revokes permission
// Body: { action: "GRANT" | "REVOKE" | "RESET", permission, reason?, expires_at? }
export async function POST(request: NextRequest, { params }: { params: Promise<{ userId: string }> }) {
  const { userId } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // Only users with MANAGE_PERMISSIONS can do this
  const canManage = await hasPermission(supabase, user.id, PERMISSIONS.MANAGE_PERMISSIONS);
  if (!canManage) {
    return NextResponse.json({
      error: "ต้องมีสิทธิ์ MANAGE_PERMISSIONS",
      hint: "ติดต่อ superadmin เพื่อขอสิทธิ์",
    }, { status: 403 });
  }

  const body = await request.json();
  const { action, permission, reason, expires_at } = body;

  if (!action || !permission) {
    return NextResponse.json({ error: "ต้องระบุ action และ permission" }, { status: 400 });
  }

  if (!["GRANT", "REVOKE", "RESET"].includes(action)) {
    return NextResponse.json({ error: "action ต้องเป็น GRANT, REVOKE หรือ RESET" }, { status: 400 });
  }

  const expiresDate = expires_at ? new Date(expires_at) : null;

  let result;
  switch (action) {
    case "GRANT":
      result = await grantPermission(supabase, {
        userId,
        permission: permission as PermissionCode,
        reason,
        expiresAt: expiresDate,
      }, user.id);
      break;
    case "REVOKE":
      result = await revokePermission(supabase, {
        userId,
        permission: permission as PermissionCode,
        reason,
        expiresAt: expiresDate,
      }, user.id);
      break;
    case "RESET":
      result = await resetToRoleDefault(supabase, userId, permission as PermissionCode, user.id);
      break;
    default:
      return NextResponse.json({ error: "invalid action" }, { status: 400 });
  }

  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 500 });
  }

  notifyAdmin(supabase, {
    actorId: user.id,
    action: `Permission ${action}: ${permission}`,
    targetType: "user",
    targetId: userId,
    link: `/admin/users`,
    severity: "warn",
  }).catch(() => {});

  return NextResponse.json({ success: true, action, permission });
}
