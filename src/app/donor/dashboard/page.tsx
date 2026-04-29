import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Heart, BarChart3, Receipt } from "lucide-react";

export default async function DonorDashboardPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("skc_users")
    .select("role, name")
    .eq("id", user.id)
    .single();

  if (!profile || !["donor", "admin", "superadmin"].includes(profile.role)) {
    redirect("/");
  }

  return (
    <div className="container max-w-4xl mx-auto py-8 px-4 space-y-6">
      <div className="flex items-center gap-3">
        <Heart className="size-8 text-pink-600" />
        <div>
          <h1 className="text-2xl font-bold">สวัสดี, {profile.name}</h1>
          <p className="text-sm text-muted-foreground">หน้าหลักสำหรับผู้บริจาค</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Link href="/donor/donate">
          <Card className="hover:border-pink-300 hover:shadow-sm transition-all cursor-pointer h-full">
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2">
                <Heart className="size-5 text-pink-600" />
                ร่วมบริจาค
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">สนับสนุนกองทุน นศ.</p>
            </CardContent>
          </Card>
        </Link>

        <Link href="/donor/impact">
          <Card className="hover:border-pink-300 hover:shadow-sm transition-all cursor-pointer h-full">
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2">
                <BarChart3 className="size-5 text-blue-600" />
                ผลกระทบ
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">ดู impact ของเงินบริจาค</p>
            </CardContent>
          </Card>
        </Link>

        <Link href="/donor/audit">
          <Card className="hover:border-pink-300 hover:shadow-sm transition-all cursor-pointer h-full">
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2">
                <Receipt className="size-5 text-green-600" />
                ตรวจสอบการใช้งาน
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">audit trail on-chain</p>
            </CardContent>
          </Card>
        </Link>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">ทางลัด</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          <Link href="/donor/donate"><Button variant="outline" size="sm">บริจาคทันที</Button></Link>
          <Link href="/donor/impact"><Button variant="outline" size="sm">ดู Impact</Button></Link>
          <Link href="/donor/audit"><Button variant="outline" size="sm">Audit</Button></Link>
        </CardContent>
      </Card>
    </div>
  );
}
