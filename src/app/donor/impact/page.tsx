"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { TrendingUp, Users, Briefcase, Award, Heart } from "lucide-react";
import { cn } from "@/lib/utils";

export default function DonorImpactPage() {
  const [stats, setStats] = useState({ totalDonated: 0, totalDonors: 0, studentsHelped: 0, jobsCompleted: 0, credentialsIssued: 0 });
  const [loading, setLoading] = useState(true);
  const supabase = createClient();

  useEffect(() => {
    async function load() {
      const [{ data: donations }, { count: donors }, { count: students }, { count: jobs }, { count: creds }] = await Promise.all([
        supabase.from("skc_donation_funds").select("amount"),
        supabase.from("skc_users").select("*", { count: "exact", head: true }).eq("role", "donor"),
        supabase.from("skc_users").select("*", { count: "exact", head: true }).eq("role", "student"),
        supabase.from("skc_jobs").select("*", { count: "exact", head: true }).eq("status", "COMPLETED"),
        supabase.from("skc_student_credentials").select("*", { count: "exact", head: true }).eq("is_active", true),
      ]);

      setStats({
        totalDonated: (donations ?? []).reduce((sum, d) => sum + Number(d.amount), 0),
        totalDonors: donors ?? 0,
        studentsHelped: students ?? 0,
        jobsCompleted: jobs ?? 0,
        credentialsIssued: creds ?? 0,
      });
      setLoading(false);
    }
    load();
  }, []);

  if (loading) return <div className="flex justify-center py-20"><div className="animate-spin size-8 border-4 border-pink-500 border-t-transparent rounded-full" /></div>;

  const cards = [
    { label: "บริจาคทั้งหมด", value: `${stats.totalDonated.toLocaleString()} TRPB`, icon: Heart, color: "text-pink-600", bg: "bg-pink-100" },
    { label: "ผู้บริจาค", value: stats.totalDonors, icon: Users, color: "text-purple-600", bg: "bg-purple-100" },
    { label: "นักศึกษาที่ได้รับประโยชน์", value: stats.studentsHelped, icon: Users, color: "text-blue-600", bg: "bg-blue-100" },
    { label: "งานสำเร็จ", value: stats.jobsCompleted, icon: Briefcase, color: "text-green-600", bg: "bg-green-100" },
    { label: "ใบรับรองทักษะ", value: stats.credentialsIssued, icon: Award, color: "text-amber-600", bg: "bg-amber-100" },
  ];

  return (
    <div className="space-y-6">
      <Card className="bg-gradient-to-br from-pink-500 to-purple-600 text-white">
        <CardContent className="text-center py-8">
          <TrendingUp className="size-10 mx-auto mb-3" />
          <h2 className="text-2xl font-bold">ผลกระทบจากการบริจาค</h2>
          <p className="text-sm opacity-90 mt-1">ทุกบาทสร้างโอกาสให้นักศึกษาช่าง มทร.ล้านนา</p>
        </CardContent>
      </Card>

      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        {cards.map((c) => (
          <Card key={c.label}>
            <CardContent className="flex items-center gap-3 pt-4 pb-4">
              <div className={cn("flex size-10 items-center justify-center rounded-xl", c.bg)}>
                <c.icon className={cn("size-5", c.color)} />
              </div>
              <div>
                <div className="text-xl font-bold text-foreground">{c.value}</div>
                <div className="text-xs text-muted-foreground">{c.label}</div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
