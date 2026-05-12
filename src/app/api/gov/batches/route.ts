import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createBatch, listCandidateJobs } from "@/lib/gov-batch";

/**
 * GET /api/gov/batches            — list batches (staff/admin)
 * GET /api/gov/batches?candidates=1&start=YYYY-MM-DD&end=YYYY-MM-DD
 *                                 — list eligible jobs for a period
 * POST /api/gov/batches           — create new batch
 *   Body: { period_start, period_end, job_ids: string[] }
 */

async function requireStaff(supabase: Awaited<ReturnType<typeof createClient>>) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { user: null, profile: null };
  const { data: profile } = await supabase
    .from("skc_users").select("role").eq("id", user.id).single();
  if (!profile || !["admin", "superadmin", "project_staff", "rmutl_staff"].includes(profile.role)) {
    return { user, profile: null };
  }
  return { user, profile };
}

export async function GET(req: NextRequest) {
  const supabase = await createClient();
  const { user, profile } = await requireStaff(supabase);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!profile) return NextResponse.json({ error: "เฉพาะคณะทำงาน/แอดมิน" }, { status: 403 });

  const { searchParams } = req.nextUrl;

  // Candidate-jobs lookup
  if (searchParams.get("candidates") === "1") {
    const start = searchParams.get("start");
    const end = searchParams.get("end");
    if (!start || !end) return NextResponse.json({ error: "missing start/end" }, { status: 400 });
    try {
      const jobs = await listCandidateJobs(supabase, start, end);
      return NextResponse.json({ jobs });
    } catch (e) {
      return NextResponse.json({ error: e instanceof Error ? e.message : "failed" }, { status: 500 });
    }
  }

  // List batches
  const { data, error } = await supabase
    .from("skc_gov_approval_batches")
    .select(`
      *,
      creator:skc_users!skc_gov_approval_batches_created_by_fkey(name),
      approver:skc_users!skc_gov_approval_batches_approved_by_fkey(name)
    `)
    .order("created_at", { ascending: false });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ batches: data });
}

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { user, profile } = await requireStaff(supabase);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!profile) return NextResponse.json({ error: "เฉพาะคณะทำงาน/แอดมิน" }, { status: 403 });

  const body = await req.json() as {
    period_start?: string;
    period_end?: string;
    job_ids?: string[];
  };
  const { period_start, period_end, job_ids } = body;
  if (!period_start || !period_end) {
    return NextResponse.json({ error: "ขาดช่วงเวลา" }, { status: 400 });
  }
  if (!Array.isArray(job_ids) || job_ids.length === 0) {
    return NextResponse.json({ error: "ต้องเลือกอย่างน้อย 1 งาน" }, { status: 400 });
  }

  try {
    const batch = await createBatch(supabase, {
      periodStart: period_start,
      periodEnd: period_end,
      jobIds: job_ids,
      createdBy: user.id,
    });
    return NextResponse.json({ batch }, { status: 201 });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "failed" }, { status: 500 });
  }
}
