import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { hashReviewContent } from "@/lib/credential";

// POST /api/chat/[jobId]/messages — send message
export async function POST(request: NextRequest, { params }: { params: Promise<{ jobId: string }> }) {
  const { jobId } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // ตรวจสิทธิ์: ต้องเป็นผู้เกี่ยวข้องกับงาน หรือ staff
  const { data: userProfile } = await supabase.from("users").select("role").eq("id", user.id).single();
  const isStaff = ["admin", "superadmin", "project_staff", "rmutl_staff", "teacher"].includes(userProfile?.role ?? "");
  const { data: jobCheck } = await supabase.from("jobs").select("employer_id, student_id, mentor_id").eq("id", jobId).single();
  if (!jobCheck) return NextResponse.json({ error: "ไม่พบงาน" }, { status: 404 });
  if (!isStaff && jobCheck.employer_id !== user.id && jobCheck.student_id !== user.id && jobCheck.mentor_id !== user.id) {
    return NextResponse.json({ error: "ไม่มีสิทธิ์ส่งข้อความใน chat นี้" }, { status: 403 });
  }

  const body = await request.json();
  const { content, message_type, metadata } = body;
  if (!content) return NextResponse.json({ error: "ต้องมีเนื้อหา" }, { status: 400 });

  // Get room
  const { data: room } = await supabase.from("job_chat_rooms").select("id, is_locked").eq("job_id", jobId).single();
  if (!room) return NextResponse.json({ error: "ไม่พบห้อง chat" }, { status: 404 });
  if (room.is_locked) return NextResponse.json({ error: "ห้อง chat ถูกล็อคแล้ว" }, { status: 403 });

  // Hash for agreements
  let contentHash = null;
  if (message_type === "AGREEMENT" && metadata) {
    contentHash = await hashReviewContent(metadata);
  }

  const { data, error } = await supabase.from("chat_messages").insert({
    room_id: room.id,
    sender_id: user.id,
    message_type: message_type ?? "TEXT",
    content,
    content_hash: contentHash,
    metadata: metadata ?? null,
  }).select("*, sender:users!chat_messages_sender_id_fkey(name, role)").single();

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json(data, { status: 201 });
}
