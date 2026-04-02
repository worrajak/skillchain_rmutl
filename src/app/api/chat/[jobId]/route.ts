import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// GET /api/chat/[jobId] — get or create chat room + messages
export async function GET(_: NextRequest, { params }: { params: Promise<{ jobId: string }> }) {
  const { jobId } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // Get or create room
  let { data: room } = await supabase.from("job_chat_rooms").select("*").eq("job_id", jobId).single();

  if (!room) {
    const { data: newRoom } = await supabase.from("job_chat_rooms").insert({ job_id: jobId }).select().single();
    room = newRoom;
    if (!room) return NextResponse.json({ error: "ไม่สามารถสร้างห้อง chat" }, { status: 500 });

    // Add participants from job
    const { data: job } = await supabase.from("jobs").select("employer_id, student_id, mentor_id").eq("id", jobId).single();
    if (job) {
      const participants = [
        { room_id: room.id, user_id: job.employer_id, role_in_chat: "employer" },
      ];
      if (job.student_id) participants.push({ room_id: room.id, user_id: job.student_id, role_in_chat: "student" });
      if (job.mentor_id) participants.push({ room_id: room.id, user_id: job.mentor_id, role_in_chat: "staff" });
      await supabase.from("chat_participants").insert(participants);
    }
  }

  // Get messages
  const { data: messages } = await supabase
    .from("chat_messages")
    .select("*, sender:users!chat_messages_sender_id_fkey(name, role)")
    .eq("room_id", room.id)
    .eq("is_deleted", false)
    .order("created_at", { ascending: true });

  // Get participants
  const { data: participants } = await supabase
    .from("chat_participants")
    .select("*, user:users!chat_participants_user_id_fkey(name, role)")
    .eq("room_id", room.id);

  return NextResponse.json({ room, messages: messages ?? [], participants: participants ?? [] });
}
