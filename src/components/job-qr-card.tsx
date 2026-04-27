"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Download, Printer, RefreshCw } from "lucide-react";
import { toast } from "sonner";

interface Props {
  jobId: string;
  jobTitle?: string;
}

interface QrData {
  qr_token: string;
  url: string;
  qr_data_url: string;
}

export default function JobQrCard({ jobId, jobTitle }: Props) {
  const [qr, setQr] = useState<QrData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    load();
  }, [jobId]);

  async function load() {
    setLoading(true);
    try {
      const res = await fetch(`/api/jobs/${jobId}/qr`);
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error ?? "โหลด QR ไม่สำเร็จ");
        return;
      }
      setQr(data);
    } finally {
      setLoading(false);
    }
  }

  function download() {
    if (!qr) return;
    const link = document.createElement("a");
    link.href = qr.qr_data_url;
    link.download = `skillchain-job-${qr.qr_token}.png`;
    link.click();
    toast.success("ดาวน์โหลด QR สำเร็จ");
  }

  function print() {
    if (!qr) return;
    const w = window.open("", "_blank");
    if (!w) return;
    w.document.write(`
      <html>
        <head><title>SkillChain Job QR — ${jobTitle ?? jobId}</title></head>
        <body style="text-align:center; font-family:'TH Sarabun New',sans-serif; padding:40px;">
          <h2 style="font-size:24pt;">SkillChain — งาน${jobTitle ? `: ${jobTitle}` : ""}</h2>
          <img src="${qr.qr_data_url}" style="width:300px;" />
          <p style="font-size:14pt;">สแกนเพื่อ check-in / ส่งงาน / ตรวจสอบ</p>
          <p style="font-size:12pt; color:#888;">รหัส: ${qr.qr_token}</p>
        </body>
      </html>
    `);
    w.document.close();
    setTimeout(() => w.print(), 500);
  }

  if (loading) {
    return (
      <Card>
        <CardContent className="p-6 text-center text-sm text-muted-foreground">
          กำลังโหลด QR...
        </CardContent>
      </Card>
    );
  }

  if (!qr) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          📷 QR Code ของงานนี้
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="bg-white p-4 rounded-lg flex justify-center">
          <img src={qr.qr_data_url} alt="Job QR Code" className="size-48" />
        </div>

        <div className="text-xs text-center text-muted-foreground break-all">
          <code>{qr.url}</code>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <Button onClick={download} variant="outline" size="sm">
            <Download className="size-4 mr-1" /> บันทึกรูป
          </Button>
          <Button onClick={print} variant="outline" size="sm">
            <Printer className="size-4 mr-1" /> พิมพ์
          </Button>
        </div>

        <div className="text-xs bg-blue-50 p-2 rounded">
          💡 <strong>วิธีใช้:</strong> พิมพ์ QR แล้วแปะที่เครื่องที่จะซ่อม
          นักศึกษาสแกนเพื่อ check-in / ส่งงาน
          ผู้ว่าจ้างสแกนเพื่อยืนยัน + ประเมิน
        </div>
      </CardContent>
    </Card>
  );
}
