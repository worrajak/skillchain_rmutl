import { NextRequest, NextResponse } from "next/server";
import { testOpenRouterKey } from "@/lib/ai/server";

// POST /api/ai/test-key
// Body: { provider: "openrouter", apiKey: string }
// Tests if a key works with the provider — never persists the key.
export async function POST(req: NextRequest) {
  try {
    const { provider, apiKey } = await req.json() as { provider?: string; apiKey?: string };
    if (!apiKey) return NextResponse.json({ ok: false, error: "ขาด apiKey" }, { status: 400 });

    if (provider === "openrouter" || !provider) {
      const result = await testOpenRouterKey(apiKey);
      return NextResponse.json(result);
    }

    return NextResponse.json({ ok: false, error: `provider "${provider}" ยังไม่รองรับ — ใช้ openrouter ก่อน` }, { status: 400 });
  } catch (e) {
    return NextResponse.json({ ok: false, error: e instanceof Error ? e.message : "test failed" }, { status: 500 });
  }
}
