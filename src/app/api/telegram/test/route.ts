import { NextRequest, NextResponse } from "next/server";
import { sendTelegramMessage } from "@/lib/telegram";

/**
 * GET /api/telegram/test
 *
 * ตรวจว่าการแจ้งเตือน Telegram ยังทำงานอยู่จริงหรือไม่
 *
 * ตัวส่งใน src/lib/telegram.ts ออกแบบให้เงียบเมื่อพลาด — คืน false แล้วจบ
 * ไม่มี log ไม่มี error ระบบเดินต่อเหมือนไม่มีอะไรเกิดขึ้น ถ้า token หมดอายุ
 * หรือ chat_id เปลี่ยน การแจ้งเตือนจะหายไปเงียบ ๆ โดยไม่มีใครรู้
 * endpoint นี้จึงตรวจทีละชั้นแล้วบอกว่าพังตรงไหน
 *
 * Auth: `?secret=<CRON_SECRET>` หรือ `Authorization: Bearer <CRON_SECRET>`
 * (ใช้ค่าเดียวกับ cron routes เพราะ endpoint นี้ยิงข้อความออกได้)
 *
 * ตรวจอย่างเดียวไม่ส่งข้อความ:
 *   curl "$NEXT_PUBLIC_APP_URL/api/telegram/test?secret=$CRON_SECRET"
 *
 * ตรวจแล้วส่งข้อความทดสอบเข้า Telegram ด้วย:
 *   curl "$NEXT_PUBLIC_APP_URL/api/telegram/test?secret=$CRON_SECRET&send=1"
 *
 * ไม่คืนค่า token หรือ chat_id ออกมา — รายงานแค่ว่ามีหรือไม่มี
 */
export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return NextResponse.json({ error: "CRON_SECRET not configured" }, { status: 500 });
  }
  const fromQuery = req.nextUrl.searchParams.get("secret");
  const fromHeader = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (fromQuery !== secret && fromHeader !== secret) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_OWNER_CHAT_ID;
  const appUrl = process.env.NEXT_PUBLIC_APP_URL;

  const checks: Record<string, unknown> = {
    TELEGRAM_BOT_TOKEN: token ? "ตั้งค่าแล้ว" : "ไม่ได้ตั้งค่า",
    TELEGRAM_OWNER_CHAT_ID: chatId ? "ตั้งค่าแล้ว" : "ไม่ได้ตั้งค่า",
    NEXT_PUBLIC_APP_URL: appUrl ?? "ไม่ได้ตั้งค่า",
  };

  if (!token) {
    return NextResponse.json({
      ok: false,
      สรุป: "ไม่ได้ตั้งค่า TELEGRAM_BOT_TOKEN — การแจ้งเตือนทุกช่องทางเงียบทั้งหมด",
      checks,
    });
  }

  // ชั้นที่ 1 — token ใช้ได้จริงไหม (getMe ไม่ส่งข้อความหาใคร)
  let botOk = false;
  let botName: string | null = null;
  let botError: string | null = null;
  try {
    const res = await fetch(`https://api.telegram.org/bot${token}/getMe`);
    const body = await res.json();
    botOk = Boolean(body?.ok);
    botName = body?.result?.username ? `@${body.result.username}` : null;
    if (!botOk) botError = body?.description ?? `HTTP ${res.status}`;
  } catch (e) {
    botError = e instanceof Error ? e.message : String(e);
  }

  checks.bot = botOk ? `เชื่อมต่อได้ · ${botName}` : `เชื่อมต่อไม่ได้ · ${botError}`;

  if (!botOk) {
    return NextResponse.json({
      ok: false,
      สรุป: "token ใช้ไม่ได้ — อาจถูก revoke หรือคัดลอกมาไม่ครบ ขอ token ใหม่จาก @BotFather",
      checks,
    });
  }

  if (!chatId) {
    return NextResponse.json({
      ok: false,
      สรุป: `bot ${botName} ทำงานปกติ แต่ไม่ได้ตั้ง TELEGRAM_OWNER_CHAT_ID จึงไม่รู้ว่าจะส่งหาใคร`,
      checks,
    });
  }

  // ชั้นที่ 2 — ส่งได้จริงไหม (ต่อเมื่อขอมาด้วย ?send=1)
  const shouldSend = req.nextUrl.searchParams.get("send") === "1";
  if (!shouldSend) {
    return NextResponse.json({
      ok: true,
      สรุป: `bot ${botName} และ chat_id พร้อมใช้งาน · เพิ่ม &send=1 เพื่อทดสอบส่งข้อความจริง`,
      checks,
    });
  }

  const now = new Date().toLocaleString("th-TH", { timeZone: "Asia/Bangkok" });
  const sent = await sendTelegramMessage(
    chatId,
    `🔔 <b>ทดสอบการแจ้งเตือน</b>\n\nระบบแจ้งเตือน SkillChain ทำงานปกติ\nเวลา ${now}`
  );

  checks.ส่งข้อความ = sent ? "สำเร็จ" : "ล้มเหลว";

  return NextResponse.json({
    ok: sent,
    สรุป: sent
      ? "ส่งสำเร็จ — ถ้าไม่เห็นข้อความใน Telegram แปลว่า chat_id ชี้ไปที่แชทอื่น"
      : "ส่งไม่สำเร็จ — bot ใช้ได้แต่ส่งเข้า chat นี้ไม่ได้ อาจถูกบล็อกหรือยังไม่เคยกด /start กับ bot",
    checks,
  });
}
