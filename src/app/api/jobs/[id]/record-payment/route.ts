import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createNotification } from "@/lib/telegram";

// POST /api/jobs/[id]/record-payment
// Employer บันทึก tx hash หลัง release escrow on-chain สำเร็จ
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json();
  const { tx_hash } = body;
  if (!tx_hash)
    return NextResponse.json(
      { error: "ต้องระบุ tx_hash" },
      { status: 400 }
    );

  // ตรวจสอบ: ต้องเป็น employer ของงานนี้ + status COMPLETED
  const { data: job } = await supabase
    .from("jobs")
    .select("employer_id, student_id, status, escrow_tx")
    .eq("id", id)
    .single();

  if (!job)
    return NextResponse.json({ error: "ไม่พบงาน" }, { status: 404 });
  if (job.employer_id !== user.id)
    return NextResponse.json(
      { error: "เฉพาะผู้ว่าจ้างเท่านั้น" },
      { status: 403 }
    );
  if (job.status !== "COMPLETED")
    return NextResponse.json(
      { error: "งานยังไม่เสร็จสมบูรณ์" },
      { status: 400 }
    );
  if (job.escrow_tx)
    return NextResponse.json(
      { error: "บันทึก payment แล้ว" },
      { status: 400 }
    );

  // บันทึก tx hash
  const { error } = await supabase
    .from("jobs")
    .update({ escrow_tx: tx_hash })
    .eq("id", id);

  if (error)
    return NextResponse.json({ error: error.message }, { status: 500 });

  // แจ้ง student
  await createNotification(supabase, {
    user_id: job.student_id,
    type: "payment_released",
    title: "ได้รับค่าจ้าง",
    body: `ค่าจ้างถูกปล่อยแล้ว — ตรวจสอบ tx: ${tx_hash.slice(0, 12)}...`,
    link: `/student/wallet`,
  });

  return NextResponse.json({
    message: "บันทึก payment สำเร็จ",
    tx_hash,
  });
}
