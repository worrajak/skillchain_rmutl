"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { FileText, Loader2, Download } from "lucide-react";
import { toast } from "sonner";

interface GenerateDocButtonProps {
  activityId: string;
  variant?: "activity-approval" | "disbursement" | "work-cert";
  label?: string;
}

const ENDPOINT_BY_VARIANT: Record<string, string> = {
  "activity-approval": "/api/gov/activity-approvals",
  // Future: disbursement, work-cert
};

export function GenerateDocButton({
  activityId,
  variant = "activity-approval",
  label = "ออกเอกสาร DOCX",
}: GenerateDocButtonProps) {
  const [loading, setLoading] = useState(false);
  const [fileUrl, setFileUrl] = useState<string | null>(null);

  async function handleGenerate() {
    setLoading(true);
    try {
      const base = ENDPOINT_BY_VARIANT[variant];
      const res = await fetch(`${base}/${activityId}/generate-doc`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });

      // If Storage upload failed, the API returns the file directly
      const contentType = res.headers.get("content-type") || "";
      if (contentType.includes("wordprocessingml")) {
        const blob = await res.blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `activity-approval-${activityId}.docx`;
        document.body.appendChild(a);
        a.click();
        a.remove();
        URL.revokeObjectURL(url);
        toast.success("ดาวน์โหลดเอกสารสำเร็จ (จากเครื่อง — ไม่ได้บันทึกบน Storage)");
        return;
      }

      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || "ออกเอกสารไม่สำเร็จ", { duration: 8000 });
        return;
      }

      toast.success("ออกเอกสารสำเร็จ — บันทึกใน Storage แล้ว");
      setFileUrl(data.file_url);
      // Auto-trigger download
      window.open(data.file_url, "_blank");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "เกิดข้อผิดพลาด");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <Button onClick={handleGenerate} disabled={loading} className="bg-blue-600 hover:bg-blue-700">
        {loading ? (
          <><Loader2 className="size-4 mr-1 animate-spin" />กำลังสร้างเอกสาร...</>
        ) : (
          <><FileText className="size-4 mr-1" />{label}</>
        )}
      </Button>
      {fileUrl && (
        <a
          href={fileUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="text-xs text-blue-600 hover:underline flex items-center gap-1"
        >
          <Download className="size-3" /> ดาวน์โหลดอีกครั้ง
        </a>
      )}
    </div>
  );
}
