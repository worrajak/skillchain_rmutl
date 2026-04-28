/**
 * Permissions System (Hybrid Role + Per-User Override)
 * ======================================================
 * Default permissions ตาม role + admin grant/revoke per user
 *
 * Usage in API routes:
 *   const allowed = await hasPermission(supabase, userId, "POST_JOB");
 *   if (!allowed) return forbidden();
 *
 * Usage in components:
 *   const perms = useEffectivePermissions(userId);
 *   if (perms.includes("EVALUATE_AS_TEACHER")) { ... }
 */

// ============================================================================
// Permission Codes (typed)
// ============================================================================

export const PERMISSIONS = {
  // JOB
  POST_JOB: "POST_JOB",
  APPROVE_JOB_ASSIGNMENT: "APPROVE_JOB_ASSIGNMENT",
  ASSIGN_STAFF_SUPERVISOR: "ASSIGN_STAFF_SUPERVISOR",
  RELEASE_ESCROW: "RELEASE_ESCROW",
  CANCEL_JOB: "CANCEL_JOB",
  RESOLVE_DISPUTE: "RESOLVE_DISPUTE",
  // EVALUATION
  EVALUATE_AS_TEACHER: "EVALUATE_AS_TEACHER",
  REVIEW_AS_EMPLOYER: "REVIEW_AS_EMPLOYER",
  REVIEW_AS_MENTOR: "REVIEW_AS_MENTOR",
  CERTIFY_WORK: "CERTIFY_WORK",
  ISSUE_CREDENTIAL: "ISSUE_CREDENTIAL",
  AWARD_CREDITS: "AWARD_CREDITS",
  REVOKE_CREDITS: "REVOKE_CREDITS",
  // GOV WORKFLOW
  CREATE_ACTIVITY_APPROVAL: "CREATE_ACTIVITY_APPROVAL",
  APPROVE_ACTIVITY: "APPROVE_ACTIVITY",
  CREATE_CONTRACT: "CREATE_CONTRACT",
  VERIFY_TIMESHEET: "VERIFY_TIMESHEET",
  CREATE_DISBURSEMENT: "CREATE_DISBURSEMENT",
  APPROVE_DISBURSEMENT_HEAD: "APPROVE_DISBURSEMENT_HEAD",
  APPROVE_DISBURSEMENT_FINANCE: "APPROVE_DISBURSEMENT_FINANCE",
  APPROVE_DISBURSEMENT_FINAL: "APPROVE_DISBURSEMENT_FINAL",
  RECORD_PAYMENT: "RECORD_PAYMENT",
  GENERATE_OFFICIAL_DOC: "GENERATE_OFFICIAL_DOC",
  // USER MANAGEMENT
  APPROVE_USER: "APPROVE_USER",
  MANAGE_USERS: "MANAGE_USERS",
  MANAGE_PERMISSIONS: "MANAGE_PERMISSIONS",
  INVITE_USER: "INVITE_USER",
  RESET_PIN: "RESET_PIN",
  VIEW_USER_DETAILS: "VIEW_USER_DETAILS",
  DEACTIVATE_USER: "DEACTIVATE_USER",
  ASSIGN_ROLE: "ASSIGN_ROLE",
  // FUND
  MANAGE_FUND: "MANAGE_FUND",
  VIEW_FUND_AUDIT: "VIEW_FUND_AUDIT",
  DONATE: "DONATE",
  // REPORTS
  VIEW_REPORTS: "VIEW_REPORTS",
  VIEW_AUDIT_LOG: "VIEW_AUDIT_LOG",
  EXPORT_DATA: "EXPORT_DATA",
  // SYSTEM
  MANAGE_FEES: "MANAGE_FEES",
  MANAGE_TIERS: "MANAGE_TIERS",
  MANAGE_BUDGET: "MANAGE_BUDGET",
  MANAGE_TELEGRAM: "MANAGE_TELEGRAM",
} as const;

export type PermissionCode = (typeof PERMISSIONS)[keyof typeof PERMISSIONS];

// ============================================================================
// Categories (for UI grouping)
// ============================================================================

export const PERMISSION_CATEGORIES: Record<string, { label_th: string; icon: string; order: number }> = {
  job: { label_th: "การจ้างงาน", icon: "💼", order: 1 },
  eval: { label_th: "การประเมิน", icon: "⭐", order: 2 },
  gov: { label_th: "เอกสารราชการ", icon: "📋", order: 3 },
  user: { label_th: "จัดการผู้ใช้", icon: "👥", order: 4 },
  fund: { label_th: "กองทุน", icon: "💰", order: 5 },
  report: { label_th: "รายงาน", icon: "📊", order: 6 },
  sys: { label_th: "ระบบ", icon: "⚙️", order: 7 },
};

// ============================================================================
// API Helpers
// ============================================================================

export interface UserPermission {
  permission_code: PermissionCode;
  source: "role" | "granted";
  expires_at: string | null;
}

/**
 * Get all effective permissions for a user (role default + grants - revokes).
 * Calls DB function `get_user_permissions(user_id)`.
 */
export async function getUserPermissions(
  supabase: any,
  userId: string
): Promise<UserPermission[]> {
  const { data, error } = await supabase.rpc("get_user_permissions", { p_user_id: userId });
  if (error) {
    console.error("[permissions] getUserPermissions error:", error);
    return [];
  }
  return data || [];
}

/**
 * Check if user has a specific permission.
 * Uses role-based fallback + per-user override.
 */
export async function hasPermission(
  supabase: any,
  userId: string,
  permission: PermissionCode
): Promise<boolean> {
  const { data, error } = await supabase.rpc("has_permission", {
    p_user_id: userId,
    p_permission: permission,
  });
  if (error) {
    console.error("[permissions] hasPermission error:", error);
    return false;
  }
  return !!data;
}

/**
 * Check multiple permissions at once. Returns map of permission → boolean.
 */
export async function hasPermissions(
  supabase: any,
  userId: string,
  permissions: PermissionCode[]
): Promise<Record<string, boolean>> {
  const all = await getUserPermissions(supabase, userId);
  const allCodes = new Set(all.map((p) => p.permission_code));
  const result: Record<string, boolean> = {};
  for (const perm of permissions) {
    result[perm] = allCodes.has(perm);
  }
  return result;
}

/**
 * Hybrid check — allow if user has permission OR has matching role.
 * Use during gradual migration.
 */
export async function hasPermissionOrRole(
  supabase: any,
  userId: string,
  permission: PermissionCode,
  fallbackRoles: string[]
): Promise<boolean> {
  // Check permission first
  if (await hasPermission(supabase, userId, permission)) return true;

  // Fallback: check role
  const { data: profile } = await supabase
    .from("skc_users")
    .select("role")
    .eq("id", userId)
    .single();
  return profile && fallbackRoles.includes(profile.role);
}

// ============================================================================
// Permission Catalog Loader
// ============================================================================

export interface PermissionInfo {
  code: PermissionCode;
  category: string;
  label_th: string;
  label_en?: string;
  description_th?: string;
  is_dangerous: boolean;
  sort_order: number;
}

/**
 * Load all permissions from catalog.
 */
export async function loadPermissionCatalog(supabase: any): Promise<PermissionInfo[]> {
  const { data } = await supabase
    .from("skc_permissions")
    .select("*")
    .order("sort_order", { ascending: true });
  return data || [];
}

/**
 * Group permissions by category for UI display.
 */
export function groupPermissionsByCategory(perms: PermissionInfo[]): Record<string, PermissionInfo[]> {
  const groups: Record<string, PermissionInfo[]> = {};
  for (const p of perms) {
    if (!groups[p.category]) groups[p.category] = [];
    groups[p.category].push(p);
  }
  return groups;
}

// ============================================================================
// Admin Operations
// ============================================================================

export interface GrantParams {
  userId: string;
  permission: PermissionCode;
  reason?: string;
  expiresAt?: Date | null;
}

/**
 * Grant a permission to a user (admin operation).
 */
export async function grantPermission(
  supabase: any,
  params: GrantParams,
  performedBy: string
): Promise<{ ok: boolean; error?: string }> {
  // Deactivate any previous override for this permission
  await supabase
    .from("skc_user_permission_overrides")
    .update({ is_active: false })
    .eq("user_id", params.userId)
    .eq("permission_code", params.permission)
    .eq("is_active", true);

  // Insert new override
  const { error } = await supabase.from("skc_user_permission_overrides").insert({
    user_id: params.userId,
    permission_code: params.permission,
    action: "GRANT",
    granted_by: performedBy,
    reason: params.reason,
    expires_at: params.expiresAt?.toISOString() ?? null,
    is_active: true,
  });

  if (error) return { ok: false, error: error.message };

  // Audit log
  await supabase.from("skc_permission_audit_log").insert({
    user_id: params.userId,
    permission_code: params.permission,
    action: "GRANT",
    performed_by: performedBy,
    reason: params.reason,
  });

  return { ok: true };
}

/**
 * Revoke a permission from a user (admin operation).
 * Creates a REVOKE override (overrides role default).
 */
export async function revokePermission(
  supabase: any,
  params: GrantParams,
  performedBy: string
): Promise<{ ok: boolean; error?: string }> {
  // Deactivate previous overrides
  await supabase
    .from("skc_user_permission_overrides")
    .update({ is_active: false })
    .eq("user_id", params.userId)
    .eq("permission_code", params.permission)
    .eq("is_active", true);

  // Insert REVOKE record
  const { error } = await supabase.from("skc_user_permission_overrides").insert({
    user_id: params.userId,
    permission_code: params.permission,
    action: "REVOKE",
    granted_by: performedBy,
    reason: params.reason,
    expires_at: params.expiresAt?.toISOString() ?? null,
    is_active: true,
  });

  if (error) return { ok: false, error: error.message };

  await supabase.from("skc_permission_audit_log").insert({
    user_id: params.userId,
    permission_code: params.permission,
    action: "REVOKE",
    performed_by: performedBy,
    reason: params.reason,
  });

  return { ok: true };
}

/**
 * Reset to role default (remove any per-user override).
 */
export async function resetToRoleDefault(
  supabase: any,
  userId: string,
  permission: PermissionCode,
  performedBy: string
): Promise<{ ok: boolean; error?: string }> {
  const { error } = await supabase
    .from("skc_user_permission_overrides")
    .update({ is_active: false })
    .eq("user_id", userId)
    .eq("permission_code", permission)
    .eq("is_active", true);

  if (error) return { ok: false, error: error.message };

  await supabase.from("skc_permission_audit_log").insert({
    user_id: userId,
    permission_code: permission,
    action: "RESET_TO_DEFAULT",
    performed_by: performedBy,
  });

  return { ok: true };
}

// ============================================================================
// Role-permission helpers
// ============================================================================

/**
 * Get default permissions for a role.
 */
export async function getRoleDefaultPermissions(
  supabase: any,
  role: string
): Promise<PermissionCode[]> {
  const { data } = await supabase
    .from("skc_role_permissions")
    .select("permission_code")
    .eq("role", role);
  return (data || []).map((r: any) => r.permission_code as PermissionCode);
}
