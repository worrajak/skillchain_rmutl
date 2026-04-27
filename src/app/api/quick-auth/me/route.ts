import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getQuickSession, QUICK_SESSION_COOKIE } from "@/lib/quick-auth";

// GET /api/quick-auth/me
// Returns: current user from quick session, or null
export async function GET(request: NextRequest) {
  const sessionToken = request.cookies.get(QUICK_SESSION_COOKIE)?.value;
  if (!sessionToken) return NextResponse.json({ user: null });

  const supabase = await createClient();
  const session = await getQuickSession(supabase, sessionToken);
  if (!session) return NextResponse.json({ user: null });

  return NextResponse.json({ user: session.user });
}
