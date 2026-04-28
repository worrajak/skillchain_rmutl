import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { loadPermissionCatalog } from "@/lib/permissions";

// GET /api/permissions/catalog
// Returns master list of all permissions with metadata
export async function GET(_request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const catalog = await loadPermissionCatalog(supabase);
  return NextResponse.json({ catalog });
}
