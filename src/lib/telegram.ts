// Telegram Bot integration for SkillChain notifications
const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const OWNER_CHAT_ID = process.env.TELEGRAM_OWNER_CHAT_ID;
const BASE_URL = `https://api.telegram.org/bot${BOT_TOKEN}`;

/**
 * Notify the project owner (admin chat) — used for ops-level events:
 * batches created/approved, payments released, disputes raised, etc.
 *
 * Owner chat_id is set via TELEGRAM_OWNER_CHAT_ID env var.
 */
export async function notifyOwner(text: string, link?: string | null): Promise<boolean> {
  if (!OWNER_CHAT_ID) return false;
  return sendTelegramMessage(OWNER_CHAT_ID, text, link);
}

/**
 * Structured admin notification — mirrors every high-signal action to the
 * admin's Telegram chat so the operator can observe "who did what" during testing.
 *
 * Usage (fire-and-forget — DO NOT await, DO NOT throw):
 *
 *   notifyAdmin(supabase, {
 *     actorId: staffId,
 *     action: "อนุมัติงาน",
 *     targetType: "job",
 *     targetId: jobId,
 *     targetTitle: "เปลี่ยนน้ำมันเครื่อง โซ่ และสเตอร์",
 *     link: `/admin/jobs?id=${jobId}`,
 *     severity: "info",
 *   }).catch(() => {});
 *
 * Goes only to TELEGRAM_OWNER_CHAT_ID (DM, not group). Resolves chat_id once
 * per call; if env var missing, returns silently.
 */
export interface AdminNotifyOpts {
  actorId?: string | null;          // skc_users.id of who triggered the action
  actorName?: string | null;        // optional pre-resolved name to skip lookup
  action: string;                   // verb phrase: "อนุมัติงาน", "ปล่อย TRPB", "เปิดข้อพิพาท"
  targetType?: string;              // "job", "user", "dispute", "batch", "activity"
  targetId?: string | null;
  targetTitle?: string | null;      // human-readable label of the target
  link?: string | null;             // relative URL to deep-link into the system
  severity?: "info" | "warn" | "alert";  // controls emoji prefix
  extra?: string;                   // optional second-line context (counts, amounts, etc.)
}

export async function notifyAdmin(
  supabase: { from: (table: string) => unknown },
  opts: AdminNotifyOpts,
): Promise<boolean> {
  if (!OWNER_CHAT_ID || !BOT_TOKEN) return false;

  // Resolve actor name if not provided (best-effort)
  let actorName = opts.actorName ?? null;
  let actorRole: string | null = null;
  if (!actorName && opts.actorId) {
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data } = await (supabase as any)
        .from("skc_users")
        .select("name, role")
        .eq("id", opts.actorId)
        .single();
      actorName = data?.name ?? null;
      actorRole = data?.role ?? null;
    } catch {
      // ignore — best-effort
    }
  }

  const severityEmoji = opts.severity === "alert" ? "🚨" : opts.severity === "warn" ? "⚠️" : "✅";
  const roleEmoji = actorRole === "student" ? "🎓"
    : actorRole === "employer" ? "👔"
    : actorRole === "teacher" ? "👨‍🏫"
    : actorRole === "project_staff" || actorRole === "rmutl_staff" ? "🛡️"
    : actorRole === "admin" || actorRole === "superadmin" ? "👑"
    : actorRole === "donor" ? "💝"
    : "👤";

  const actorLabel = actorName ?? (opts.actorId ? opts.actorId.slice(0, 8) : "ระบบ");
  const target = opts.targetTitle
    ? `<b>${escapeHtml(opts.targetTitle)}</b>`
    : opts.targetId
      ? `<code>${escapeHtml(opts.targetId.slice(0, 8))}</code>`
      : "";

  const lines = [
    `${severityEmoji} ${roleEmoji} <b>${escapeHtml(actorLabel)}</b> ${escapeHtml(opts.action)}`,
    target ? `${typeEmoji(opts.targetType)} ${target}` : null,
    opts.extra ? `   ${escapeHtml(opts.extra)}` : null,
  ].filter(Boolean) as string[];

  return sendTelegramMessage(OWNER_CHAT_ID, lines.join("\n"), opts.link ?? null);
}

function typeEmoji(targetType?: string): string {
  switch (targetType) {
    case "job": return "💼";
    case "user": return "👤";
    case "dispute": return "⚖️";
    case "batch": return "📄";
    case "activity": return "🎉";
    case "training": return "📚";
    case "review": return "⭐";
    default: return "🔗";
  }
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c] ?? c));
}

/**
 * Notify multiple users by ID — looks up telegram_chat_id for each and sends.
 * Used for batch approvals where we notify all employers + students at once.
 */
export async function notifyUsersByTelegram(
  supabase: { from: (table: string) => unknown },
  userIds: string[],
  title: string,
  body: string,
  link?: string | null,
): Promise<void> {
  if (!BOT_TOKEN || userIds.length === 0) return;
  // Batch lookup chat ids
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data } = await (supabase as any)
      .from("skc_users")
      .select("id, telegram_chat_id")
      .in("id", userIds);
    const tasks: Promise<unknown>[] = [];
    for (const u of data ?? []) {
      if (u.telegram_chat_id) {
        tasks.push(sendTelegramMessage(u.telegram_chat_id, `<b>${title}</b>\n${body}`, link));
      }
    }
    await Promise.allSettled(tasks);
  } catch {
    // best-effort
  }
}

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
