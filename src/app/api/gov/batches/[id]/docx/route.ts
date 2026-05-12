import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { generateBatchDocx } from "@/lib/gov-batch-docx";
import type { CandidateJob } from "@/lib/gov-batch";

/**
 * GET /api/gov/batches/[id]/docx — download DOCX for the batch
 */
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: batch, error } = await supabase
    .from("skc_gov_approval_batches")
    .select("id, batch_no, period_start, period_end")
    .eq("id", id)
    .single();
  if (error || !batch) return NextResponse.json({ error: "ไม่พบ batch" }, { status: 404 });

  const { data: jobs } = await supabase
    .from("skc_jobs")
    .select(`
      id, title, type, job_category, pay_amount, deadline, required_workers,
      campus, location, description, gov_status, gov_batch_id, created_at,
      employer:skc_users!skc_jobs_employer_id_fkey(name, organization)
    `)
    .eq("gov_batch_id", id);

  const buf = await generateBatchDocx({
    batchNo: batch.batch_no,
    periodStart: batch.period_start,
    periodEnd: batch.period_end,
    jobs: (jobs as unknown as CandidateJob[]) ?? [],
  });

  return new NextResponse(buf as unknown as BodyInit, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "Content-Disposition": `attachment; filename="batch-${batch.batch_no}.docx"`,
    },
  });
}
