import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import QRCode from "qrcode";

// GET /api/checkin/qr?job_id=xxx — generate QR code for job check-in
export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const jobId = new URL(request.url).searchParams.get("job_id");
  const courseId = new URL(request.url).searchParams.get("course_id");

  if (!jobId && !courseId) {
    return NextResponse.json({ error: "ต้องระบุ job_id หรือ course_id" }, { status: 400 });
  }

  // ตรวจสอบสิทธิ์ — ผู้จ้าง/staff สร้าง QR สำหรับงาน, staff สร้าง QR สำหรับอบรม
  if (jobId) {
    const { data: job } = await supabase.from("jobs")
      .select("employer_id, title").eq("id", jobId).single();
    if (!job) return NextResponse.json({ error: "ไม่พบงาน" }, { status: 404 });

    const { data: profile } = await supabase.from("users").select("role").eq("id", user.id).single();
    const isStaff = ["admin", "superadmin", "project_staff", "rmutl_staff", "teacher"].includes(profile?.role ?? "");
    if (job.employer_id !== user.id && !isStaff) {
      return NextResponse.json({ error: "ไม่มีสิทธิ์สร้าง QR" }, { status: 403 });
    }
  }

  if (courseId) {
    const { data: profile } = await supabase.from("users").select("role").eq("id", user.id).single();
    const isStaff = ["admin", "superadmin", "project_staff", "rmutl_staff", "teacher"].includes(profile?.role ?? "");
    if (!isStaff) {
      return NextResponse.json({ error: "เฉพาะเจ้าหน้าที่/อาจารย์" }, { status: 403 });
    }
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "";
  const qrData = jobId
    ? `${appUrl}/checkin?job_id=${jobId}`
    : `${appUrl}/checkin?course_id=${courseId}`;

  const qrImage = await QRCode.toDataURL(qrData, {
    width: 400,
    margin: 2,
    color: { dark: "#1e3a5f", light: "#ffffff" },
  });

  return NextResponse.json({ qr: qrImage, url: qrData });
}
