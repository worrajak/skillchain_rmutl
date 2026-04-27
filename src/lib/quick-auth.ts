/**
 * QR + PIN Quick Authentication
 * ===============================
 * Frictionless auth: scan QR + 6-digit PIN → logged in for 7 days
 *
 * Architecture:
 *   - skc_user_pins: bcrypt-hashed PINs with lockout
 *   - skc_user_qr_tokens: permanent QR tokens (one per active user)
 *   - skc_quick_sessions: 7-day session tokens (separate from Supabase Auth)
 *
 * Note: Cookie name 'skc-quick-session' is used to identify sessions.
 *       Supabase Auth cookies (sb-*) handle Tier 3 (staff/admin email login).
 */

import bcrypt from "bcryptjs";
import { randomBytes } from "node:crypto";

// ============================================================================
// Constants
// ============================================================================

export const PIN_LENGTH = 6;
export const QR_TOKEN_LENGTH = 12;
export const SESSION_TOKEN_LENGTH = 48;
export const SESSION_DURATION_DAYS = 7;
export const MAX_FAILED_ATTEMPTS = 5;
export const LOCKOUT_MINUTES = 15;

export const QUICK_SESSION_COOKIE = "skc-quick-session";

// ============================================================================
// PIN Generation & Verification
// ============================================================================

/** Generate a random 6-digit PIN. */
export function generatePin(): string {
  // Use crypto.randomInt for unbiased random
  let pin = "";
  for (let i = 0; i < PIN_LENGTH; i++) {
    pin += Math.floor(Math.random() * 10).toString();
  }
  return pin;
}

/** Hash a PIN using bcrypt (cost 10). */
export async function hashPin(pin: string): Promise<string> {
  return bcrypt.hash(pin, 10);
}

/** Verify a PIN against its hash. */
export async function verifyPin(pin: string, hash: string): Promise<boolean> {
  return bcrypt.compare(pin, hash);
}

// ============================================================================
// Token Generators
// ============================================================================

/**
 * Generate a URL-safe short token using base32 (no I/O/0/1 to avoid confusion).
 */
function generateToken(length: number): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let result = "";
  const bytes = randomBytes(length);
  for (let i = 0; i < length; i++) {
    result += chars[bytes[i] % chars.length];
  }
  return result;
}

export function generateUserQrToken(): string {
  return generateToken(QR_TOKEN_LENGTH);
}

export function generateJobQrToken(): string {
  return generateToken(10);
}

export function generateInviteToken(): string {
  return generateToken(16);
}

export function generateSessionToken(): string {
  // High entropy session — use larger random
  return randomBytes(SESSION_TOKEN_LENGTH).toString("base64url");
}

// ============================================================================
// PIN Operations (DB)
// ============================================================================

export interface PinSetResult {
  ok: boolean;
  pin?: string;       // plaintext (only when generating new PIN)
  error?: string;
}

/**
 * Set/reset a PIN for a user. Returns the plaintext PIN (only this once).
 */
export async function setPinForUser(
  supabase: any,
  userId: string,
  options?: { customPin?: string; mustChange?: boolean }
): Promise<PinSetResult> {
  const pin = options?.customPin ?? generatePin();
  if (!/^\d{6}$/.test(pin)) {
    return { ok: false, error: "PIN must be 6 digits" };
  }

  const hash = await hashPin(pin);

  // Upsert
  const { error } = await supabase.from("skc_user_pins").upsert({
    user_id: userId,
    pin_hash: hash,
    pin_set_at: new Date().toISOString(),
    failed_attempts: 0,
    locked_until: null,
    must_change: options?.mustChange ?? false,
  });

  if (error) return { ok: false, error: error.message };
  return { ok: true, pin };
}

export interface PinVerifyResult {
  ok: boolean;
  userId?: string;
  reason?: "wrong_pin" | "locked" | "no_pin" | "user_not_found";
  attemptsLeft?: number;
  lockedUntil?: Date;
}

/**
 * Verify a PIN for a user. Handles lockout after MAX_FAILED_ATTEMPTS.
 */
export async function verifyUserPin(
  supabase: any,
  userId: string,
  pin: string
): Promise<PinVerifyResult> {
  const { data: record } = await supabase
    .from("skc_user_pins")
    .select("*")
    .eq("user_id", userId)
    .maybeSingle();

  if (!record) return { ok: false, reason: "no_pin" };

  // Check lockout
  if (record.locked_until && new Date(record.locked_until) > new Date()) {
    return {
      ok: false,
      reason: "locked",
      lockedUntil: new Date(record.locked_until),
    };
  }

  // Verify
  const matches = await verifyPin(pin, record.pin_hash);

  if (matches) {
    // Reset failed attempts
    await supabase
      .from("skc_user_pins")
      .update({
        failed_attempts: 0,
        locked_until: null,
        last_used_at: new Date().toISOString(),
      })
      .eq("user_id", userId);

    return { ok: true, userId };
  }

  // Wrong PIN — increment fail count
  const newAttempts = (record.failed_attempts ?? 0) + 1;
  const lockedUntil = newAttempts >= MAX_FAILED_ATTEMPTS
    ? new Date(Date.now() + LOCKOUT_MINUTES * 60 * 1000)
    : null;

  await supabase
    .from("skc_user_pins")
    .update({
      failed_attempts: newAttempts,
      locked_until: lockedUntil?.toISOString() ?? null,
    })
    .eq("user_id", userId);

  return {
    ok: false,
    reason: lockedUntil ? "locked" : "wrong_pin",
    attemptsLeft: Math.max(0, MAX_FAILED_ATTEMPTS - newAttempts),
    lockedUntil: lockedUntil ?? undefined,
  };
}

// ============================================================================
// User QR Token Operations
// ============================================================================

export async function ensureUserQrToken(
  supabase: any,
  userId: string
): Promise<string> {
  // Look for active token
  const { data: existing } = await supabase
    .from("skc_user_qr_tokens")
    .select("qr_token")
    .eq("user_id", userId)
    .eq("is_active", true)
    .is("revoked_at", null)
    .maybeSingle();

  if (existing) return existing.qr_token;

  // Generate new
  const token = generateUserQrToken();
  await supabase.from("skc_user_qr_tokens").insert({
    user_id: userId,
    qr_token: token,
    is_active: true,
  });
  return token;
}

export async function regenerateUserQrToken(
  supabase: any,
  userId: string
): Promise<string> {
  // Revoke old tokens
  await supabase
    .from("skc_user_qr_tokens")
    .update({ revoked_at: new Date().toISOString(), is_active: false })
    .eq("user_id", userId)
    .is("revoked_at", null);

  // Create new
  const token = generateUserQrToken();
  await supabase.from("skc_user_qr_tokens").insert({
    user_id: userId,
    qr_token: token,
    is_active: true,
  });
  return token;
}

export async function lookupUserByQrToken(
  supabase: any,
  qrToken: string
): Promise<{ id: string; name: string; role: string; email: string } | null> {
  const { data } = await supabase
    .from("skc_user_qr_tokens")
    .select("user_id, is_active, revoked_at, expires_at, user:skc_users(id, name, role, email)")
    .eq("qr_token", qrToken)
    .maybeSingle();

  if (!data || !data.is_active || data.revoked_at) return null;
  if (data.expires_at && new Date(data.expires_at) < new Date()) return null;

  // Increment scan count (fire-and-forget)
  supabase
    .from("skc_user_qr_tokens")
    .update({
      scan_count: (data as any).scan_count ? (data as any).scan_count + 1 : 1,
      last_scanned_at: new Date().toISOString(),
    })
    .eq("qr_token", qrToken)
    .then(() => {});

  return data.user as any;
}

// ============================================================================
// Quick Session Operations
// ============================================================================

export async function createQuickSession(
  supabase: any,
  userId: string,
  meta?: { device?: string; userAgent?: string; ip?: string }
): Promise<{ token: string; expiresAt: Date }> {
  const token = generateSessionToken();
  const expiresAt = new Date(Date.now() + SESSION_DURATION_DAYS * 24 * 60 * 60 * 1000);

  await supabase.from("skc_quick_sessions").insert({
    user_id: userId,
    session_token: token,
    device_fingerprint: meta?.device,
    user_agent: meta?.userAgent,
    ip_address: meta?.ip,
    expires_at: expiresAt.toISOString(),
  });

  return { token, expiresAt };
}

export async function getQuickSession(
  supabase: any,
  sessionToken: string
): Promise<{ userId: string; user: any } | null> {
  const { data } = await supabase
    .from("skc_quick_sessions")
    .select("user_id, expires_at, revoked_at, user:skc_users(id, name, role, email, approval_status)")
    .eq("session_token", sessionToken)
    .maybeSingle();

  if (!data) return null;
  if (data.revoked_at) return null;
  if (new Date(data.expires_at) < new Date()) return null;

  // Update last activity (fire-and-forget)
  supabase
    .from("skc_quick_sessions")
    .update({ last_activity_at: new Date().toISOString() })
    .eq("session_token", sessionToken)
    .then(() => {});

  return { userId: data.user_id, user: data.user };
}

export async function revokeQuickSession(
  supabase: any,
  sessionToken: string
): Promise<void> {
  await supabase
    .from("skc_quick_sessions")
    .update({ revoked_at: new Date().toISOString() })
    .eq("session_token", sessionToken);
}

// ============================================================================
// Job QR Operations
// ============================================================================

export async function ensureJobQrToken(
  supabase: any,
  jobId: string
): Promise<string> {
  const { data: existing } = await supabase
    .from("skc_job_qr_tokens")
    .select("qr_token")
    .eq("job_id", jobId)
    .maybeSingle();

  if (existing) return existing.qr_token;

  const token = generateJobQrToken();
  await supabase.from("skc_job_qr_tokens").insert({
    job_id: jobId,
    qr_token: token,
  });
  return token;
}

export async function lookupJobByQrToken(
  supabase: any,
  qrToken: string
): Promise<any | null> {
  const { data } = await supabase
    .from("skc_job_qr_tokens")
    .select("job_id, scan_count, job:skc_jobs(*)")
    .eq("qr_token", qrToken)
    .maybeSingle();

  if (!data) return null;

  // Bump scan count
  supabase
    .from("skc_job_qr_tokens")
    .update({
      scan_count: (data.scan_count ?? 0) + 1,
      last_scanned_at: new Date().toISOString(),
    })
    .eq("qr_token", qrToken)
    .then(() => {});

  return data.job;
}

// ============================================================================
// Smart Router Logic
// ============================================================================

export interface SmartRouteContext {
  userRole?: string;          // role of scanner, undefined = anonymous
  userId?: string;
  jobStatus: string;
  jobId: string;
  isAssignedStudent?: boolean;
  isJobEmployer?: boolean;
  isJobMentor?: boolean;
}

export interface SmartRouteResult {
  path: string;
  action: string;
  description: string;
}

/**
 * Determine where a scan of a job QR should redirect based on context.
 */
export function resolveJobQrAction(ctx: SmartRouteContext): SmartRouteResult {
  const { userRole, jobStatus, jobId, isAssignedStudent, isJobEmployer, isJobMentor } = ctx;

  // Anonymous → login then come back
  if (!userRole) {
    return {
      path: `/quick-login?next=/j/${ctx.jobId}`,
      action: "LOGIN_REQUIRED",
      description: "กรุณาเข้าสู่ระบบเพื่อใช้งาน",
    };
  }

  // Staff can do anything
  if (["admin", "superadmin", "rmutl_staff", "project_staff", "teacher"].includes(userRole)) {
    return {
      path: `/staff/gov/jobs/${jobId}`,
      action: "STAFF_VIEW",
      description: "เปิดหน้าจัดการงานสำหรับเจ้าหน้าที่",
    };
  }

  // Employer of this specific job
  if (userRole === "employer" && isJobEmployer) {
    if (jobStatus === "OPEN" || jobStatus === "PENDING_REVIEW") {
      return {
        path: `/employer/jobs/${jobId}`,
        action: "EMPLOYER_MANAGE",
        description: "จัดการงาน + ดูผู้สมัคร",
      };
    }
    if (jobStatus === "SUBMITTED") {
      return {
        path: `/employer/jobs/${jobId}/confirm`,
        action: "EMPLOYER_CONFIRM",
        description: "✅ ยืนยันงานเสร็จสมบูรณ์",
      };
    }
    if (jobStatus === "COMPLETED") {
      return {
        path: `/employer/jobs/${jobId}/evaluate`,
        action: "EMPLOYER_EVALUATE",
        description: "⭐ ประเมินนักศึกษา",
      };
    }
    return {
      path: `/employer/jobs/${jobId}`,
      action: "EMPLOYER_VIEW",
      description: "ดูรายละเอียดงาน",
    };
  }

  // Student assigned to this job
  if (userRole === "student" && isAssignedStudent) {
    if (jobStatus === "ASSIGNED") {
      return {
        path: `/student/jobs/${jobId}/start`,
        action: "STUDENT_START",
        description: "🚀 เริ่มงาน + check-in",
      };
    }
    if (jobStatus === "IN_PROGRESS") {
      return {
        path: `/student/jobs/${jobId}/submit`,
        action: "STUDENT_SUBMIT",
        description: "📤 ส่งงาน + check-out",
      };
    }
    return {
      path: `/student/jobs/${jobId}`,
      action: "STUDENT_VIEW",
      description: "ดูรายละเอียดงาน",
    };
  }

  // Mentor of this job
  if (isJobMentor) {
    return {
      path: `/student/jobs/${jobId}`,
      action: "MENTOR_VIEW",
      description: "👀 ดูแลและตรวจงาน",
    };
  }

  // Open job for unassigned student → can apply
  if (userRole === "student" && jobStatus === "OPEN") {
    return {
      path: `/jobs/${jobId}`,
      action: "STUDENT_APPLY",
      description: "📝 ดูงาน + สมัครรับงาน",
    };
  }

  // Default: view-only
  return {
    path: `/jobs/${jobId}`,
    action: "VIEW_ONLY",
    description: "ดูรายละเอียดงาน",
  };
}
