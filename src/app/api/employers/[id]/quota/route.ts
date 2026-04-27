import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// GET /api/employers/[id]/quota — ดูโควต้าของผู้ว่าจ้าง
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: employer } = await supabase
    .from("skc_users")
    .select("id, name, role, job_quota, job_quota_used")
    .eq("id", id)
    .single();

  if (!employer)
    return NextResponse.json({ error: "ไม่พบผู้ใช้" }, { status: 404 });

  return NextResponse.json({
    employer_id: employer.id,
    name: employer.name,
    job_quota: employer.job_quota,
    job_quota_used: employer.job_quota_used,
    remaining: Math.max(0, employer.job_quota - employer.job_quota_used),
  });
}

// PATCH /api/employers/[id]/quota — ตั้งค่าโควต้า (staff/admin เท่านั้น)
export async function PATCH(
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

  // ตรวจสิทธิ์
  const { data: profile } = await supabase
    .from("skc_users")
    .select("role")
    .eq("id", user.id)
    .single();

  const allowedRoles = ["admin", "superadmin", "project_staff", "rmutl_staff"];
  if (!profile || !allowedRoles.includes(profile.role)) {
    return NextResponse.json(
      { error: "เฉพาะ staff/admin เท่านั้น" },
      { status: 403 }
    );
  }

  const body = await request.json();
  const { quota } = body;

  if (typeof quota !== "number" || quota < 0) {
    return NextResponse.json(
      { error: "โควต้าต้องเป็นตัวเลข >= 0" },
      { status: 400 }
    );
  }

  const { data: updated, error } = await supabase
    .from("skc_users")
    .update({ job_quota: quota })
    .eq("id", id)
    .select("id, name, job_quota, job_quota_used")
    .single();

  if (error)
    return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({
    message: `ตั้งโควต้าเป็น ${quota} ครั้งแล้ว`,
    ...updated,
    remaining: Math.max(0, updated.job_quota - updated.job_quota_used),
  });
}
