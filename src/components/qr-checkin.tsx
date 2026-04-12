"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { QrCode, Download, Loader2 } from "lucide-react";

interface QRCheckInProps {
  jobId?: string;
  courseId?: string;
  title: string;
}

export function QRCheckIn({ jobId, courseId, title }: QRCheckInProps) {
  const [qrImage, setQrImage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function generateQR() {
    setLoading(true);
    const params = jobId ? `job_id=${jobId}` : `course_id=${courseId}`;
    const res = await fetch(`/api/checkin/qr?${params}`);
    const data = await res.json();
    if (data.qr) {
      setQrImage(data.qr);
    }
    setLoading(false);
  }

  function downloadQR() {
    if (!qrImage) return;
    const link = document.createElement("a");
    link.href = qrImage;
    link.download = `QR-${title.slice(0, 20)}.png`;
    link.click();
  }

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm flex items-center gap-2 text-foreground">
          <QrCode className="size-4 text-blue-600" />
          QR เช็คอิน/เช็คเอาท์
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {!qrImage ? (
          <Button onClick={generateQR} disabled={loading} variant="outline" className="w-full">
            {loading ? <Loader2 className="size-4 mr-2 animate-spin" /> : <QrCode className="size-4 mr-2" />}
            {loading ? "กำลังสร้าง..." : "สร้าง QR Code"}
          </Button>
        ) : (
          <div className="text-center space-y-3">
            <img src={qrImage} alt="QR Check-in" className="mx-auto rounded-lg border" width={250} height={250} />
            <p className="text-xs text-muted-foreground">ให้นักศึกษาสแกน QR เพื่อเช็คอิน/เช็คเอาท์</p>
            <div className="flex gap-2 justify-center">
              <Button variant="outline" size="sm" onClick={downloadQR}>
                <Download className="size-4 mr-1" />ดาวน์โหลด
              </Button>
              <Button variant="outline" size="sm" onClick={generateQR}>
                สร้างใหม่
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
