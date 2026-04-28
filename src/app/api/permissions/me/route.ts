import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getUserPermissions, loadPermissionCatalog } from "@/lib/permissions";

// GET /api/permissions/me
// Returns current user's effective permissions + catalog metadata
export async function GET(_request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const [permissions, catalog, profileResult] = await Promise.all([
    getUserPermissions(supabase, user.id),
    loadPermissionCatalog(supabase),
    supabase.from("skc_users").select("role, name").eq("id", user.id).single(),
  ]);

  // Merge permission codes with catalog info
  const catalogMap = new Map(catalog.map((c) => [c.code, c]));
  const enriched = permissions.map((p) => ({
    ...p,
    info: catalogMap.get(p.permission_code) || null,
  }));

  return NextResponse.json({
    user: profileResult.data,
    permissions: enriched,
    catalog,
  });
}
