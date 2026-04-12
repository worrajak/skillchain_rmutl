import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createNotification } from "@/lib/telegram";

// POST /api/jobs/[id]/review-job
// คณะทำงานพิจารณางานใหม่: อนุมัติ / ปรับค่าจ้าง / ปฏิเสธ
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: jobId } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // ตรวจสอบ role
  const { data: profile } = await supabase
    .from("users")
    .select("role, name")
    .eq("id", user.id)
    .single();

  const staffRoles = ["project_staff", "rmutl_staff", "admin", "superadmin"];
  if (!profile || !staffRoles.includes(profile.role)) {
    return NextResponse.json(
      { error: "เฉพาะคณะทำงานเท่านั้น" },
      { status: 403 }
    );
  }

  const body = await request.json();
  const { action, adjusted_pay, note } = body;
  // action: "APPROVE" | "REJECT"

  // ดึงงาน
  const { data: job } = await supabase
    .from("jobs")
    .select("id, status, title, pay_amount, employer_id, type")
    .eq("id", jobId)
    .single();

  if (!job) {
    return NextResponse.json({ error: "ไม่พบงาน" }, { status: 404 });
  }

  if (job.status !== "PENDING_REVIEW") {
    return NextResponse.json(
      { error: "งานนี้ไม่ได้อยู่ในสถานะรอพิจารณา" },
      { status: 400 }
    );
  }

  if (action === "APPROVE") {
    // อนุมัติ — ปรับค่าจ้างถ้ามี
    const finalPay =
      adjusted_pay !== undefined && adjusted_pay !== null
        ? Number(adjusted_pay)
        : job.pay_amount;

    // Validate pay amount
    if (!Number.isFinite(finalPay) || finalPay < 0 || finalPay > 1000000) {
      return NextResponse.json({ error: "ค่าตอบแทนต้องอยู่ระหว่าง 0-1,000,000" }, { status: 400 });
    }

    const { error } = await supabase
      .from("jobs")
      .update({
        status: "OPEN",
        pay_amount: finalPay,
        reviewed_by_staff: user.id,
        reviewed_at: new Date().toISOString(),
        review_note: note || null,
      })
      .eq("id", jobId);

    if (error) {
      return NextResponse.json(
        { error: "อนุมัติไม่สำเร็จ: " + error.message },
        { status: 500 }
      );
    }

    // แจ้งผู้ว่าจ้าง
    const payMsg =
      finalPay !== job.pay_amount
        ? ` (ปรับค่าจ้างเป็น ${finalPay.toLocaleString()} TRPB)`
        : "";
    await createNotification(supabase, {
      user_id: job.employer_id,
      type: "job_approved",
      title: "งานได้รับอนุมัติแล้ว",
      body: `"${job.title}" ผ่านการพิจารณา${payMsg} — เปิดรับนักศึกษาแล้ว`,
      link: `/employer/jobs/${jobId}`,
    });

    return NextResponse.json({
      message: "อนุมัติงานสำเร็จ",
      final_pay: finalPay,
      adjusted: finalPay !== job.pay_amount,
    });
  }

  if (action === "REJECT") {
    const { error } = await supabase
      .from("jobs")
      .update({
        status: "CANCELLED",
        reviewed_by_staff: user.id,
        reviewed_at: new Date().toISOString(),
        review_note: note || "ไม่ผ่านการพิจารณา",
      })
      .eq("id", jobId);

    if (error) {
      return NextResponse.json(
        { error: "ปฏิเสธไม่สำเร็จ: " + error.message },
        { status: 500 }
      );
    }

    // แจ้งผู้ว่าจ้าง
    await createNotification(supabase, {
      user_id: job.employer_id,
      type: "job_rejected",
      title: "งานไม่ผ่านการพิจารณา",
      body: `"${job.title}" — ${note || "กรุณาติดต่อคณะทำงาน"}`,
      link: `/employer/jobs`,
    });

    return NextResponse.json({ message: "ปฏิเสธงานแล้ว" });
  }

  return NextResponse.json(
    { error: "action ต้องเป็น APPROVE หรือ REJECT" },
    { status: 400 }
  );
}
