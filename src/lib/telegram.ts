// Telegram Bot integration for SkillChain notifications
const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const BASE_URL = `https://api.telegram.org/bot${BOT_TOKEN}`;

export async function sendTelegramMessage(chatId: string, text: string, link?: string | null): Promise<boolean> {
  if (!BOT_TOKEN || !chatId) return false;

  const message = link
    ? `${text}\n\n<a href="${process.env.NEXT_PUBLIC_APP_URL ?? ""}${link}">เปิดดูในระบบ</a>`
    : text;

  try {
    const res = await fetch(`${BASE_URL}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        text: message,
        parse_mode: "HTML",
        disable_web_page_preview: true,
      }),
    });
    return res.ok;
  } catch {
    return false;
  }
}

// Send notification to user via Telegram (lookup chat_id from DB)
export async function notifyViaTelegram(
  supabase: { from: (table: string) => unknown },
  userId: string,
  title: string,
  body: string,
  link?: string | null,
): Promise<void> {
  if (!BOT_TOKEN) return;

  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data } = await (supabase as any).from("skc_users").select("telegram_chat_id").eq("id", userId).single();
    if (data?.telegram_chat_id) {
      await sendTelegramMessage(data.telegram_chat_id, `<b>${title}</b>\n${body}`, link);
    }
  } catch {
    // silently fail — Telegram is best-effort
  }
}

// Helper: create notification in DB + send Telegram
export async function createNotification(
  supabase: { from: (table: string) => unknown },
  notification: {
    user_id: string;
    type: string;
    title: string;
    body: string;
    link?: string | null;
  },
): Promise<void> {
  // Insert to DB
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (supabase as any).from("skc_notifications").insert(notification);

  // Send Telegram (non-blocking)
  notifyViaTelegram(supabase, notification.user_id, notification.title, notification.body, notification.link);
}

// Batch version
export async function createNotifications(
  supabase: { from: (table: string) => unknown },
  notifications: Array<{
    user_id: string;
    type: string;
    title: string;
    body: string;
    link?: string | null;
  }>,
): Promise<void> {
  // Insert all to DB
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (supabase as any).from("skc_notifications").insert(notifications);

  // Send Telegram to each (non-blocking)
  for (const n of notifications) {
    notifyViaTelegram(supabase, n.user_id, n.title, n.body, n.link);
  }
}

// Generate a unique link token for connecting Telegram
export function generateLinkToken(userId: string): string {
  const crypto = require("crypto");
  const hmac = crypto.createHmac("sha256", BOT_TOKEN ?? "secret");
  hmac.update(userId + Date.now().toString());
  return hmac.digest("hex").slice(0, 16);
}
