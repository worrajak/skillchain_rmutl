"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, XCircle, Clock, Shield } from "lucide-react";
import { PERMISSION_CATEGORIES } from "@/lib/permissions";
import { cn } from "@/lib/utils";

interface Permission {
  permission_code: string;
  source: "role" | "granted";
  expires_at: string | null;
  info?: {
    code: string;
    category: string;
    label_th: string;
    description_th?: string;
    is_dangerous: boolean;
    sort_order: number;
  };
}

interface CatalogItem {
  code: string;
  category: string;
  label_th: string;
  description_th?: string;
  is_dangerous: boolean;
  sort_order: number;
}

interface Props {
  permissions: Permission[];
  catalog: CatalogItem[];
  userName?: string;
  userRole?: string;
  showAll?: boolean; // show denied perms too
}

export default function PermissionsChecklist({
  permissions,
  catalog,
  userName,
  userRole,
  showAll = false,
}: Props) {
  const grantedCodes = new Set(permissions.map((p) => p.permission_code));
  const sourceMap = new Map(permissions.map((p) => [p.permission_code, p]));

  // Group catalog by category
  const grouped: Record<string, CatalogItem[]> = {};
  for (const c of catalog) {
    if (!grouped[c.category]) grouped[c.category] = [];
    grouped[c.category].push(c);
  }

  const sortedCategories = Object.entries(grouped).sort(
    ([a], [b]) => (PERMISSION_CATEGORIES[a]?.order ?? 99) - (PERMISSION_CATEGORIES[b]?.order ?? 99)
  );

  return (
    <div className="space-y-4">
      {/* Header summary */}
      {userName && (
        <Card>
          <CardContent className="py-4">
            <div className="flex items-center gap-3">
              <Shield className="size-8 text-blue-600" />
              <div className="flex-1">
                <div className="font-bold text-lg">{userName}</div>
                <div className="text-sm text-muted-foreground">
                  Role: <Badge variant="outline">{userRole}</Badge>
                </div>
              </div>
              <div className="text-right">
                <div className="text-2xl font-bold text-green-600">{permissions.length}</div>
                <div className="text-xs text-muted-foreground">สิทธิ์ที่มี</div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Permissions by category */}
      {sortedCategories.map(([category, items]) => {
        const categoryInfo = PERMISSION_CATEGORIES[category];
        const grantedInCategory = items.filter((i) => grantedCodes.has(i.code));
        if (!showAll && grantedInCategory.length === 0) return null;

        return (
          <Card key={category}>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <span>{categoryInfo?.icon}</span>
                {categoryInfo?.label_th ?? category}
                <Badge variant="secondary" className="ml-auto">
                  {grantedInCategory.length} / {items.length}
                </Badge>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {items.map((item) => {
                  const isGranted = grantedCodes.has(item.code);
                  const source = sourceMap.get(item.code);

                  if (!showAll && !isGranted) return null;

                  return (
                    <div
                      key={item.code}
                      className={cn(
                        "flex items-start gap-3 p-2 rounded text-sm",
                        isGranted ? "bg-green-50" : "bg-slate-50 opacity-60"
                      )}
                    >
                      {isGranted ? (
                        <CheckCircle2 className="size-5 text-green-600 shrink-0 mt-0.5" />
                      ) : (
                        <XCircle className="size-5 text-slate-400 shrink-0 mt-0.5" />
                      )}

                      <div className="flex-1 min-w-0">
                        <div className="font-medium flex items-center gap-2 flex-wrap">
                          {item.label_th}
                          {item.is_dangerous && (
                            <Badge variant="destructive" className="text-[10px]">
                              อันตราย
                            </Badge>
                          )}
                          {source?.source === "granted" && (
                            <Badge variant="default" className="text-[10px] bg-blue-600">
                              admin มอบให้
                            </Badge>
                          )}
                          {source?.expires_at && (
                            <Badge variant="outline" className="text-[10px]">
                              <Clock className="size-3 mr-1" />
                              หมดอายุ {new Date(source.expires_at).toLocaleDateString("th-TH")}
                            </Badge>
                          )}
                        </div>
                        {item.description_th && (
                          <div className="text-xs text-muted-foreground mt-0.5">
                            {item.description_th}
                          </div>
                        )}
                        <div className="text-[10px] text-muted-foreground/70 mt-0.5 font-mono">
                          {item.code}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
