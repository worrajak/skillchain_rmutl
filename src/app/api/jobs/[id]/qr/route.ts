import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { ensureJobQrToken } from "@/lib/quick-auth";
import QRCode from "qrcode";

// GET /api/jobs/[id]/qr → return { qr_token, url, qr_data_url (base64 image) }
export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // Permission: employer of job, staff, or admin
  const { data: job } = await supabase
    .from("skc_jobs")
    .select("id, employer_id, title")
    .eq("id", id)
    .single();
  if (!job) return NextResponse.json({ error: "ไม่พบงาน" }, { status: 404 });

  const { data: profile } = await supabase.from("skc_users").select("role").eq("id", user.id).single();
  const isStaff = profile && ["admin", "superadmin", "rmutl_staff", "project_staff"].includes(profile.role);
  const isEmployer = job.employer_id === user.id;

  if (!isStaff && !isEmployer) {
    return NextResponse.json({ error: "เฉพาะผู้ว่าจ้างหรือเจ้าหน้าที่" }, { status: 403 });
  }

  const qrToken = await ensureJobQrToken(supabase, id);
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://skillchain-rmutl.vercel.app";
  const url = `${baseUrl}/j/${qrToken}`;

  // Generate QR code as data URL
  const qrDataUrl = await QRCode.toDataURL(url, {
    errorCorrectionLevel: "M",
    margin: 2,
    width: 512,
  });

  return NextResponse.json({
    qr_token: qrToken,
    url,
    qr_data_url: qrDataUrl,
    job: { id: job.id, title: job.title },
  });
}
