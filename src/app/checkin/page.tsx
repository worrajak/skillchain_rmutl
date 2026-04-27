"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { LogIn, LogOut, MapPin, CheckCircle, AlertTriangle, Loader2 } from "lucide-react";
import { toast } from "sonner";
import Link from "next/link";

export default function CheckInPage() {
  return (
    <Suspense fallback={<div className="flex justify-center py-20"><div className="animate-spin size-8 border-4 border-blue-500 border-t-transparent rounded-full" /></div>}>
      <CheckInContent />
    </Suspense>
  );
}

function CheckInContent() {
  const searchParams = useSearchParams();
  const jobId = searchParams.get("job_id");
  const courseId = searchParams.get("course_id");

  const [user, setUser] = useState<{ id: string } | null>(null);
  const [job, setJob] = useState<Record<string, unknown> | null>(null);
  const [course, setCourse] = useState<Record<string, unknown> | null>(null);
  const [history, setHistory] = useState<Array<Record<string, unknown>>>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [location, setLocation] = useState<{ lat: number; lng: number } | null>(null);

  const supabase = createClient();

  useEffect(() => {
    // ขอ GPS
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => setLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
        () => {} // ไม่บังคับ
      );
    }

    async function load() {
      const { data: { user: u } } = await supabase.auth.getUser();
      setUser(u);
      if (!u) { setLoading(false); return; }

      if (jobId) {
        const { data: j } = await supabase.from("skc_jobs")
          .select("id, title, employer_id, student_id, status, location")
          .eq("id", jobId).single();
        setJob(j);

        // ดึงประวัติเช็คอิน
        const { data: h } = await supabase.from("skc_job_checkins")
          .select("*")
          .eq("job_id", jobId)
          .eq("user_id", u.id)
          .order("created_at", { ascending: false })
          .limit(10);
        setHistory(h ?? []);
      }

      if (courseId) {
        const { data: c } = await supabase.from("skc_training_courses")
          .select("id, title, instructor_id")
          .eq("id", courseId).single();
        setCourse(c);
      }

      setLoading(false);
    }
    load();
  }, [jobId, courseId]);

  async function handleCheckIn(type: "CHECK_IN" | "CHECK_OUT") {
    setSubmitting(true);

    if (jobId) {
      const res = await fetch("/api/checkin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          job_id: jobId,
          type,
          latitude: location?.lat,
          longitude: location?.lng,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        setDone(true);
        toast.success(type === "CHECK_IN" ? "เช็คอินสำเร็จ!" : "เช็คเอาท์สำเร็จ!");
      } else {
        toast.error(data.error);
      }
    }

    if (courseId) {
      const today = new Date().toISOString().split("T")[0];
      if (type === "CHECK_IN") {
        const { error } = await supabase.from("skc_training_attendance").upsert({
          course_id: courseId,
          trainee_id: user!.id,
          session_date: today,
          check_in_at: new Date().toISOString(),
        }, { onConflict: "course_id,trainee_id,session_date" });
        if (error) toast.error(error.message);
        else { setDone(true); toast.success("เช็คชื่อเข้าอบรมสำเร็จ!"); }
      } else {
        const { error } = await supabase.from("skc_training_attendance")
          .update({ check_out_at: new Date().toISOString() })
          .eq("course_id", courseId)
          .eq("trainee_id", user!.id)
          .eq("session_date", today);
        if (error) toast.error(error.message);
        else { setDone(true); toast.success("เช็คชื่อออกสำเร็จ!"); }
      }
    }

    setSubmitting(false);
  }

  if (loading) {
    return <div className="flex justify-center py-20"><div className="animate-spin size-8 border-4 border-blue-500 border-t-transparent rounded-full" /></div>;
  }

  if (!user) {
    return (
      <div className="max-w-md mx-auto mt-10">
        <Card className="text-center">
          <CardContent className="py-10 space-y-4">
            <AlertTriangle className="size-12 mx-auto text-yellow-500" />
            <p className="font-medium text-foreground">กรุณาเข้าสู่ระบบก่อนเช็คอิน</p>
            <Link href="/login"><Button>เข้าสู่ระบบ</Button></Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!jobId && !courseId) {
    return (
      <div className="max-w-md mx-auto mt-10">
        <Card className="text-center">
          <CardContent className="py-10">
            <AlertTriangle className="size-12 mx-auto text-yellow-500 mb-4" />
            <p className="text-foreground">QR Code ไม่ถูกต้อง</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (done) {
    return (
      <div className="max-w-md mx-auto mt-10">
        <Card className="text-center">
          <CardContent className="py-10 space-y-4">
            <CheckCircle className="size-16 mx-auto text-green-500" />
            <p className="text-lg font-bold text-foreground">สำเร็จ!</p>
            <p className="text-sm text-muted-foreground">
              {location && (
                <span className="flex items-center justify-center gap-1">
                  <MapPin className="size-3" />
                  {location.lat.toFixed(4)}, {location.lng.toFixed(4)}
                </span>
              )}
              {new Date().toLocaleString("th-TH")}
            </p>
            <Link href={jobId ? "/student/dashboard" : "/training"}>
              <Button variant="outline">กลับหน้าหลัก</Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  const title = job ? (job.title as string) : course ? (course.title as string) : "";
  const lastCheckIn = history.find((h) => h.type === "CHECK_IN");
  const lastCheckOut = history.find((h) => h.type === "CHECK_OUT");
  const isCheckedIn = lastCheckIn && (!lastCheckOut || new Date(lastCheckIn.created_at as string) > new Date(lastCheckOut.created_at as string));

  return (
    <div className="max-w-md mx-auto mt-10 space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-foreground text-center">
            {jobId ? "เช็คอิน/เช็คเอาท์งาน" : "เช็คชื่อเข้าอบรม"}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="text-center">
            <p className="font-medium text-foreground">{title}</p>
            {job?.location ? (
              <p className="text-sm text-muted-foreground flex items-center justify-center gap-1 mt-1">
                <MapPin className="size-3" />{String(job.location)}
              </p>
            ) : null}
            {location && (
              <p className="text-xs text-muted-foreground mt-1">
                GPS: {location.lat.toFixed(4)}, {location.lng.toFixed(4)}
              </p>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Button
              onClick={() => handleCheckIn("CHECK_IN")}
              disabled={submitting || (jobId ? !!isCheckedIn : false)}
              className="h-20 text-lg bg-green-600 hover:bg-green-700"
            >
              {submitting ? <Loader2 className="size-6 animate-spin" /> : (
                <>
                  <LogIn className="size-6 mr-2" />
                  เช็คอิน
                </>
              )}
            </Button>
            <Button
              onClick={() => handleCheckIn("CHECK_OUT")}
              disabled={submitting || (jobId ? !isCheckedIn : false)}
              className="h-20 text-lg bg-red-600 hover:bg-red-700"
            >
              {submitting ? <Loader2 className="size-6 animate-spin" /> : (
                <>
                  <LogOut className="size-6 mr-2" />
                  เช็คเอาท์
                </>
              )}
            </Button>
          </div>

          {/* ประวัติล่าสุด */}
          {history.length > 0 && (
            <div className="border-t pt-3">
              <p className="text-xs font-medium text-muted-foreground mb-2">ประวัติล่าสุด</p>
              <div className="space-y-1">
                {history.slice(0, 5).map((h) => (
                  <div key={h.id as string} className="flex justify-between text-xs text-muted-foreground">
                    <span className={h.type === "CHECK_IN" ? "text-green-600" : "text-red-600"}>
                      {h.type === "CHECK_IN" ? "เข้า" : "ออก"}
                    </span>
                    <span>{new Date(h.created_at as string).toLocaleString("th-TH")}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
