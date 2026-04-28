import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createNotification } from "@/lib/telegram";

// PATCH /api/warranty-claims/[id]
// Body: { status: 'IN_PROGRESS' | 'RESOLVED' | 'REJECTED', resolution_note? }
// Staff resolves the claim
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { status, resolution_note } = await request.json();
  if (!["IN_PROGRESS", "RESOLVED", "REJECTED", "ESCALATED"].includes(status)) {
    return NextResponse.json({ error: "invalid status" }, { status: 400 });
  }

  const { data: claim } = await supabase
    .from("skc_warranty_claims")
    .select("*, job:skc_jobs(id, title, approved_by_staff, employer_id, student_id, warranty_status)")
    .eq("id", id)
    .single();
  if (!claim) return NextResponse.json({ error: "ไม่พบ claim" }, { status: 404 });

  // Permission: staff supervisor of the job, or admin
  const { data: profile } = await supabase.from("skc_users").select("role").eq("id", user.id).single();
  const isSupervisor = claim.job?.approved_by_staff === user.id;
  const isStaffOrAdmin = profile && ["admin", "superadmin", "rmutl_staff", "project_staff"].includes(profile.role);
  if (!isSupervisor && !isStaffOrAdmin) {
    return NextResponse.json({ error: "เฉพาะ staff supervisor หรือ admin" }, { status: 403 });
  }

  const updates: any = {
    status,
    resolution_note,
    resolved_by: user.id,
    resolved_at: new Date().toISOString(),
  };

  const { error } = await supabase
    .from("skc_warranty_claims")
    .update(updates)
    .eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Update job warranty_status based on outcome
  if (status === "RESOLVED" || status === "REJECTED") {
    await supabase
      .from("skc_jobs")
      .update({ warranty_status: "ACTIVE" })  // Resume warranty after fix
      .eq("id", claim.job_id);
  }

  // Notify employer + student
  if (claim.claimed_by) {
    await createNotification(supabase, {
      user_id: claim.claimed_by,
      type: "warranty_resolved",
      title: status === "RESOLVED" ? "✅ Claim ของคุณได้รับการแก้ไขแล้ว" : `🚫 Claim ${status}`,
      body: resolution_note || `งาน "${claim.job?.title}"`,
      link: `/employer/jobs/${claim.job_id}`,
    });
  }
  if (claim.job?.student_id) {
    await createNotification(supabase, {
      user_id: claim.job.student_id,
      type: "warranty_resolved",
      title: `📌 Warranty Claim — ${status}`,
      body: resolution_note || `งาน "${claim.job?.title}"`,
      link: `/student/dashboard`,
    });
  }

  return NextResponse.json({ success: true, status });
}
