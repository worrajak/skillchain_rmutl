import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

/**
 * GET /api/payments/[id] — payer ดูสถานะของ payment ตัวเอง
 *                          (หรือ admin ดูใครก็ได้)
 */
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("skc_payments")
    .select("*, payer:skc_users!skc_payments_payer_id_fkey(name, email)")
    .eq("id", id)
    .single();

  if (error || !data) return NextResponse.json({ error: "ไม่พบ payment" }, { status: 404 });

  return NextResponse.json(data);
}
