import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { revokeQuickSession, QUICK_SESSION_COOKIE } from "@/lib/quick-auth";

export async function POST(request: NextRequest) {
  const sessionToken = request.cookies.get(QUICK_SESSION_COOKIE)?.value;
  if (sessionToken) {
    const supabase = await createClient();
    await revokeQuickSession(supabase, sessionToken);
  }

  const response = NextResponse.json({ ok: true });
  response.cookies.delete(QUICK_SESSION_COOKIE);
  return response;
}
