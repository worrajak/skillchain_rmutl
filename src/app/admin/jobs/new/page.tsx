import NewJobForm from "@/components/new-job-form";

export default function AdminNewJobPage() {
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold text-foreground">สร้างงานใหม่</h1>
      <NewJobForm homeUrl="/admin/jobs" />
    </div>
  );
}
