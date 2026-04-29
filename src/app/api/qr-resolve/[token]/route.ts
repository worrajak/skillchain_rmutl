import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import {
  lookupJobByQrToken,
  getQuickSession,
  resolveJobQrAction,
  QUICK_SESSION_COOKIE,
} from "@/lib/quick-auth";

// GET /api/qr-resolve/[token]
// Resolves a QR token to its target redirect URL based on the scanner's
// auth state + the job's lifecycle stage. Returns JSON so the client can
// router.replace() — avoids server-side redirect races on first iOS load.
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ token: string }> },
) {
  const { token } = await params;
  const supabase = await createClient();

  try {
    const job = await lookupJobByQrToken(supabase, token);
    if (!job) {
      return NextResponse.json(
        { error: "QR ไม่ถูกต้องหรือหมดอายุ", target: "/?error=qr_not_found" },
        { status: 404 },
      );
    }

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

    return NextResponse.json({
      target: result.path,
      action: result.action,
      description: result.description,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "ไม่ทราบสาเหตุ";
    return NextResponse.json(
      { error: `เกิดข้อผิดพลาด: ${msg}`, target: "/" },
      { status: 500 },
    );
  }
}
