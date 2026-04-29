/**
 * Smart Job QR Router
 * ====================
 * URL: /j/<qr_token>
 *
 * เมื่อมีคนสแกน QR ของงาน ระบบจะตรวจ:
 *   1. ใครสแกน (ทั้ง Supabase Auth และ Quick Session)
 *   2. งานอยู่ stage ไหน
 *   3. ความสัมพันธ์ของผู้สแกนกับงาน
 *
 * แล้ว redirect ไปหน้าที่เหมาะสม
 */

import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import {
  lookupJobByQrToken,
  getQuickSession,
  resolveJobQrAction,
  QUICK_SESSION_COOKIE,
} from "@/lib/quick-auth";

export default async function JobQrRouter({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const supabase = await createClient();

  // 1. Lookup job by token
  const job = await lookupJobByQrToken(supabase, token);
  if (!job) {
    redirect("/?error=qr_not_found");
  }

  // 2. Identify scanner — try Supabase Auth first, then Quick Session
  let userId: string | undefined;
  let userRole: string | undefined;

  const { data: { user: authUser } } = await supabase.auth.getUser();
  if (authUser) {
    userId = authUser.id;
    const { data: profile } = await supabase
      .from("skc_users")
      .select("role")
      .eq("id", userId)
      .single();
    userRole = profile?.role;
  }

  // If not Supabase auth, check Quick Session cookie
  if (!userId) {
    const cookieStore = await cookies();
    const sessionToken = cookieStore.get(QUICK_SESSION_COOKIE)?.value;
    if (sessionToken) {
      const session = await getQuickSession(supabase, sessionToken);
      if (session) {
        userId = session.userId;
        userRole = session.user?.role;
      }
    }
  }

  // 3. Resolve action based on context (pass token for proper return URL)
  const result = resolveJobQrAction({
    userRole,
    userId,
    jobStatus: job.status,
    jobId: job.id,
    token,
    isAssignedStudent: job.student_id === userId,
    isJobEmployer: job.employer_id === userId,
    isJobMentor: job.mentor_id === userId,
  });

  // 4. Redirect
  redirect(result.path);
}
