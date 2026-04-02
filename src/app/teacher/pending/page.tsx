"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Clock, Briefcase } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function TeacherPendingPage() {
  const [jobs, setJobs] = useState<Record<string, unknown>[]>([]);
  const [loading, setLoading] = useState(true);
  const supabase = createClient();

  useEffect(() => {
    async function load() {
      const { data } = await supabase
        .from("jobs")
        .select("id, title, type, status, campus, student:users!jobs_student_id_fkey(name)")
        .in("status", ["SUBMITTED", "COMPLETED"])
        .order("updated_at", { ascending: false })
        .limit(20);
      setJobs(data ?? []);
      setLoading(false);
    }
    load();
  }, []);

  if (loading) {
    return <div className="flex justify-center py-20"><div className="animate-spin size-8 border-4 border-blue-500 border-t-transparent rounded-full" /></div>;
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-foreground flex items-center gap-2">
            <Clock className="size-5" />
            งานรอประเมิน ({jobs.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {jobs.length > 0 ? (
            <div className="space-y-3">
              {jobs.map((j) => (
                <div key={String(j.id)} className="flex items-center justify-between rounded-lg border p-3">
                  <div>
                    <div className="font-medium text-sm text-foreground">{String(j.title)}</div>
                    <div className="text-xs text-muted-foreground">
                      {String(j.type)} — นศ.: {(j.student as Record<string, unknown>)?.name ? String((j.student as Record<string, unknown>).name) : "ยังไม่มี"}
                    </div>
                  </div>
                  <Link href="/teacher/evaluation">
                    <Button size="sm">ประเมิน</Button>
                  </Link>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8">
              <Briefcase className="size-10 mx-auto text-muted-foreground/40 mb-3" />
              <p className="text-sm text-muted-foreground">ไม่มีงานรอประเมินขณะนี้</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
