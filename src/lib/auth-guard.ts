import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export type StaffRole = "admin" | "superadmin" | "project_staff" | "rmutl_staff" | "teacher";

const STAFF_ROLES: string[] = ["admin", "superadmin", "project_staff", "rmutl_staff", "teacher"];

/**
 * Verify authenticated user and optionally check role.
 * Returns { user, role, supabase } or an error response.
 */
export async function authGuard(options?: { roles?: string[] }) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return {
      error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
    };
  }

  const { data: profile } = await supabase
    .from("skc_users")
    .select("role")
    .eq("id", user.id)
    .single();

  const role = profile?.role ?? "student";

  if (options?.roles && !options.roles.includes(role)) {
    return {
      error: NextResponse.json({ error: "ไม่มีสิทธิ์" }, { status: 403 }),
    };
  }

  return { user, role, supabase };
}

/** Check if user is staff (admin/superadmin/project_staff/rmutl_staff/teacher) */
export function isStaffRole(role: string): boolean {
  return STAFF_ROLES.includes(role);
}

/** Verify user is a participant in a job (employer, student, or mentor) */
export async function verifyJobParticipant(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
  jobId: string,
  role: string
): Promise<boolean> {
  // Staff can access any job
  if (isStaffRole(role)) return true;

  const { data: job } = await supabase
    .from("skc_jobs")
    .select("employer_id, student_id, mentor_id")
    .eq("id", jobId)
    .single();

  if (!job) return false;

  return (
    job.employer_id === userId ||
    job.student_id === userId ||
    job.mentor_id === userId
  );
}

/** Validate that a number is within range */
export function validateRange(
  value: unknown,
  min: number,
  max: number,
  fieldName: string
): string | null {
  const num = Number(value);
  if (!Number.isFinite(num) || num < min || num > max) {
    return `${fieldName} ต้องอยู่ระหว่าง ${min}-${max}`;
  }
  return null;
}
