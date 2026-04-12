import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { hashReviewContent } from "@/lib/credential";
import { createNotification } from "@/lib/telegram";

// POST /api/chat/[jobId]/agreement — propose agreement
export async function POST(request: NextRequest, { params }: { params: Promise<{ jobId: string }> }) {
  const { jobId } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json();
  const { agreement_type, terms } = body;
  if (!agreement_type || !terms) return NextResponse.json({ error: "Missing fields" }, { status: 400 });

  const contentHash = await hashReviewContent(terms);

  const { data, error } = await supabase.from("job_agreements").insert({
    job_id: jobId,
    proposed_by: user.id,
    agreement_type,
    terms,
    content_hash: contentHash,
  }).select().single();

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json(data, { status: 201 });
}

// PATCH /api/chat/[jobId]/agreement — accept/reject agreement
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ jobId: string }> }) {
  const { jobId } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json();
  const { agreement_id, action } = body; // action: 'ACCEPTED' | 'REJECTED'

  const { data, error } = await supabase.from("job_agreements")
    .update({ status: action, accepted_by: action === "ACCEPTED" ? user.id : null })
    .eq("id", agreement_id)
    .eq("job_id", jobId)
    .select().single();

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  // แจ้ง proposer
  if (data) {
    await createNotification(supabase, {
      user_id: data.proposed_by,
      type: "agreement",
      title: action === "ACCEPTED" ? "ข้อตกลงได้รับการยอมรับ" : "ข้อตกลงถูกปฏิเสธ",
      body: `ข้อตกลง "${data.agreement_type}" — ${action === "ACCEPTED" ? "ยอมรับแล้ว" : "ถูกปฏิเสธ"}`,
      link: `/employer/jobs/${jobId}`,
    });
  }

  return NextResponse.json(data);
}
