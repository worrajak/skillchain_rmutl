import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Check Quick Session cookie (Tier 1 — QR + PIN auth)
  const hasQuickSession = !!request.cookies.get("skc-quick-session")?.value;
  const isAuthenticated = !!user || hasQuickSession;

  // Redirect unauthenticated users to login (except public pages)
  const publicPaths = ["/", "/login", "/quick-login", "/register", "/register-trainee", "/about", "/jobs", "/training", "/verify"];
  const isPublic = publicPaths.some((p) =>
    request.nextUrl.pathname === p
  ) || request.nextUrl.pathname.startsWith("/api/auth")
    || request.nextUrl.pathname.startsWith("/api/quick-auth")
    || request.nextUrl.pathname.startsWith("/api/invitations")
    || request.nextUrl.pathname.startsWith("/jobs/")
    || request.nextUrl.pathname.startsWith("/training/")
    || request.nextUrl.pathname.startsWith("/verify/")
    || request.nextUrl.pathname.startsWith("/invite/")
    || request.nextUrl.pathname.startsWith("/j/")
    || request.nextUrl.pathname.startsWith("/guides")
    || request.nextUrl.pathname.startsWith("/api/qr")
    // Cron endpoints — auth via CRON_SECRET inside the route handler
    || request.nextUrl.pathname.startsWith("/api/cron/")
    // Telegram health check — same CRON_SECRET gate inside the route.
    // ต้องเรียกได้โดยไม่ต้อง login เพราะใช้ตรวจตอนระบบมีปัญหา
    || request.nextUrl.pathname === "/api/telegram/test"
    // Payments: anonymous donation supported · GET admin queue is gated inside the route
    || request.nextUrl.pathname.startsWith("/api/payments")
    || request.nextUrl.pathname.startsWith("/donate");

  if (!isAuthenticated && !isPublic) {
    const url = request.nextUrl.clone();
    url.pathname = "/quick-login";
    url.searchParams.set("next", request.nextUrl.pathname);
    return NextResponse.redirect(url);
  }

  return supabaseResponse;
}
