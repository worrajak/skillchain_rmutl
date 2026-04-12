import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { sendTelegramMessage } from "@/lib/telegram";

// Use service role to bypass RLS — webhook has no user session
function getAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );
}

// POST /api/telegram/webhook — Telegram Bot webhook handler
export async function POST(request: NextRequest) {
  const body = await request.json();
  const message = body.message;
  if (!message?.text || !message?.chat?.id) {
    return NextResponse.json({ ok: true });
  }

  const chatId = String(message.chat.id);
  const text = message.text.trim();

  // /start <link_token> — link Telegram to SkillChain account
  if (text.startsWith("/start")) {
    const token = text.split(" ")[1];
    if (!token) {
      await sendTelegramMessage(chatId,
        "สวัสดีครับ! นี่คือ SkillChain Bot\n\n" +
        "กรุณาเชื่อมต่อบัญชีผ่านหน้าเว็บ SkillChain:\n" +
        "ไปที่ <b>โปรไฟล์ → เชื่อมต่อ Telegram</b>"
      );
      return NextResponse.json({ ok: true });
    }

    // Lookup pending link token
    const admin = getAdminClient();
    const { data: linkData } = await admin
      .from("telegram_link_tokens")
      .select("user_id")
      .eq("token", token)
      .eq("used", false)
      .gt("expires_at", new Date().toISOString())
      .single();

    if (!linkData) {
      await sendTelegramMessage(chatId, "ลิงก์หมดอายุหรือใช้ไปแล้ว กรุณาสร้างใหม่จากหน้าเว็บ");
      return NextResponse.json({ ok: true });
    }

    // Link: save chat_id to user + mark token used
    await admin.from("users").update({ telegram_chat_id: chatId }).eq("id", linkData.user_id);
    await admin.from("telegram_link_tokens").update({ used: true }).eq("token", token);

    const { data: user } = await admin.from("users").select("name").eq("id", linkData.user_id).single();
    await sendTelegramMessage(chatId,
      `เชื่อมต่อสำเร็จ! สวัสดีคุณ ${user?.name ?? ""}\n` +
      "คุณจะได้รับแจ้งเตือนจาก SkillChain ผ่าน Telegram นี้แล้ว\n\n" +
      "พิมพ์ /status เพื่อเช็คสถานะ\n" +
      "พิมพ์ /stop เพื่อหยุดรับแจ้งเตือน"
    );
    return NextResponse.json({ ok: true });
  }

  // /status — check connection status
  if (text === "/status") {
    const admin = getAdminClient();
    const { data: user } = await admin.from("users").select("name, role, campus").eq("telegram_chat_id", chatId).single();
    if (user) {
      await sendTelegramMessage(chatId,
        `<b>สถานะ:</b> เชื่อมต่อแล้ว\n` +
        `<b>ชื่อ:</b> ${user.name}\n` +
        `<b>บทบาท:</b> ${user.role}\n` +
        `<b>วิทยาเขต:</b> ${user.campus}`
      );
    } else {
      await sendTelegramMessage(chatId, "ยังไม่ได้เชื่อมต่อบัญชี SkillChain\nไปที่ <b>โปรไฟล์ → เชื่อมต่อ Telegram</b>");
    }
    return NextResponse.json({ ok: true });
  }

  // /stop — unlink
  if (text === "/stop") {
    const admin = getAdminClient();
    await admin.from("users").update({ telegram_chat_id: null }).eq("telegram_chat_id", chatId);
    await sendTelegramMessage(chatId, "หยุดรับแจ้งเตือนแล้ว คุณสามารถเชื่อมต่อใหม่ได้จากหน้าเว็บ");
    return NextResponse.json({ ok: true });
  }

  // Default reply
  await sendTelegramMessage(chatId,
    "SkillChain Bot รองรับคำสั่ง:\n" +
    "/status — เช็คสถานะการเชื่อมต่อ\n" +
    "/stop — หยุดรับแจ้งเตือน"
  );
  return NextResponse.json({ ok: true });
}
