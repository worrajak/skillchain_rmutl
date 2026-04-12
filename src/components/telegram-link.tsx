"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { MessageCircle, Link2, Unlink, ExternalLink, Loader2 } from "lucide-react";
import { toast } from "sonner";

export function TelegramLink() {
  const [connected, setConnected] = useState(false);
  const [loading, setLoading] = useState(true);
  const [linking, setLinking] = useState(false);

  useEffect(() => {
    fetch("/api/telegram/link")
      .then((r) => r.json())
      .then((d) => setConnected(d.connected))
      .finally(() => setLoading(false));
  }, []);

  async function handleLink() {
    setLinking(true);
    try {
      const res = await fetch("/api/telegram/link", { method: "POST" });
      const data = await res.json();
      if (data.url) {
        window.open(data.url, "_blank");
        toast.success("เปิด Telegram แล้ว — กด Start เพื่อเชื่อมต่อ");
        // Poll for connection status
        const interval = setInterval(async () => {
          const r = await fetch("/api/telegram/link");
          const d = await r.json();
          if (d.connected) {
            setConnected(true);
            clearInterval(interval);
            toast.success("เชื่อมต่อ Telegram สำเร็จ!");
          }
        }, 3000);
        // Stop polling after 5 minutes
        setTimeout(() => clearInterval(interval), 5 * 60 * 1000);
      } else {
        toast.error(data.error ?? "เกิดข้อผิดพลาด");
      }
    } catch {
      toast.error("เกิดข้อผิดพลาด");
    }
    setLinking(false);
  }

  async function handleUnlink() {
    const res = await fetch("/api/telegram/link", { method: "DELETE" });
    if (res.ok) {
      setConnected(false);
      toast.success("ยกเลิกการเชื่อมต่อแล้ว");
    }
  }

  if (loading) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-foreground flex items-center gap-2">
          <MessageCircle className="size-5 text-blue-500" />
          แจ้งเตือนผ่าน Telegram
        </CardTitle>
      </CardHeader>
      <CardContent>
        {connected ? (
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-sm text-green-600">
              <Link2 className="size-4" />
              เชื่อมต่อ Telegram แล้ว — คุณจะได้รับแจ้งเตือนทาง Telegram
            </div>
            <Button variant="outline" size="sm" onClick={handleUnlink}>
              <Unlink className="size-4 mr-2" />
              ยกเลิกการเชื่อมต่อ
            </Button>
          </div>
        ) : (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              เชื่อมต่อ Telegram เพื่อรับแจ้งเตือนงาน ผลประเมิน และสถานะต่างๆ ได้ทันที
            </p>
            <Button onClick={handleLink} disabled={linking}>
              {linking ? (
                <Loader2 className="size-4 mr-2 animate-spin" />
              ) : (
                <ExternalLink className="size-4 mr-2" />
              )}
              {linking ? "กำลังสร้างลิงก์..." : "เชื่อมต่อ Telegram"}
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
