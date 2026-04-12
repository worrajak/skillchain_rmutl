import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { checkRateLimit, getClientIP, RATE_LIMITS } from "@/lib/rate-limit";
import crypto from "crypto";

const BOT_USERNAME = process.env.TELEGRAM_BOT_USERNAME ?? "SkillChainBot";

// POST /api/telegram/link — generate link token for current user
export async function POST(request: NextRequest) {
  const ip = getClientIP(request);
  const rl = checkRateLimit(ip, RATE_LIMITS.telegramLink);
  if (!rl.allowed) return NextResponse.json({ error: "ส่งคำขอบ่อยเกินไป" }, { status: 429 });

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // Generate unique token
  const token = crypto.randomBytes(16).toString("hex");
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

  // Save token
  const { error } = await supabase.from("telegram_link_tokens").insert({
    user_id: user.id,
    token,
    expires_at: expiresAt.toISOString(),
  });

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  const telegramUrl = `https://t.me/${BOT_USERNAME}?start=${token}`;

  return NextResponse.json({ url: telegramUrl, token, expires_at: expiresAt });
}

// DELETE /api/telegram/link — unlink Telegram
export async function DELETE() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  await supabase.from("users").update({ telegram_chat_id: null }).eq("id", user.id);

  return NextResponse.json({ success: true });
}

// GET /api/telegram/link — check Telegram connection status
export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data } = await supabase.from("users").select("telegram_chat_id").eq("id", user.id).single();

  return NextResponse.json({ connected: !!data?.telegram_chat_id });
}
