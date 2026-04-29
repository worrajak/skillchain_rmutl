"use client";

import { useEffect, useRef, useState } from "react";
import { Html5Qrcode } from "html5-qrcode";
import { Button } from "@/components/ui/button";
import { Camera, CameraOff } from "lucide-react";

interface QrScannerProps {
  onScan: (decoded: string) => void;
  onError?: (err: string) => void;
}

/**
 * QR Scanner with iOS Safari compatibility fixes.
 *
 * iOS Safari requires:
 *  1. HTTPS (handled by Vercel)
 *  2. <video playsinline> (forced after html5-qrcode mounts the element)
 *  3. The video container must be in the layout (NOT display:none) when
 *     start() is called — otherwise the camera initializes but the stream
 *     gets paused. We render the container always and toggle visibility.
 *  4. start() must be triggered by a user gesture (button click — already
 *     handled).
 */
export default function QrScanner({ onScan, onError }: QrScannerProps) {
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const containerId = "qr-scanner-container";
  const [scanning, setScanning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [starting, setStarting] = useState(false);

  useEffect(() => {
    return () => {
      // Cleanup on unmount
      const ref = scannerRef.current;
      if (ref) {
        ref.stop().catch(() => {});
      }
    };
  }, []);

  /** Force iOS-friendly attributes on the video element html5-qrcode created. */
  function applyIosVideoFixes() {
    const container = document.getElementById(containerId);
    if (!container) return;
    const videos = container.querySelectorAll("video");
    videos.forEach((v) => {
      v.setAttribute("playsinline", "true");
      v.setAttribute("webkit-playsinline", "true");
      v.setAttribute("autoplay", "true");
      v.setAttribute("muted", "true");
      v.muted = true;
      // Best-effort resume; safe to ignore errors
      v.play().catch(() => {});
    });
  }

  async function start() {
    try {
      setError(null);
      setStarting(true);
      // Show the container FIRST so it has layout before camera init
      setScanning(true);
      // Wait one tick for React to render the visible container
      await new Promise((r) => setTimeout(r, 50));

      if (!scannerRef.current) {
        scannerRef.current = new Html5Qrcode(containerId);
      }

      await scannerRef.current.start(
        { facingMode: "environment" },
        {
          fps: 10,
          qrbox: { width: 250, height: 250 },
          aspectRatio: 1,
        },
        (decoded) => {
          onScan(decoded);
          stop();
        },
        () => {
          // per-frame failure: silent
        },
      );

      // After camera attaches, fix iOS attributes (run twice to catch slow mounts)
      applyIosVideoFixes();
      setTimeout(applyIosVideoFixes, 200);
      setTimeout(applyIosVideoFixes, 800);

      setStarting(false);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "ไม่สามารถเปิดกล้องได้";
      const friendlyMsg =
        /permission|denied|notallowed/i.test(msg)
          ? "ไม่ได้รับสิทธิ์ใช้กล้อง — กรุณาเปิดสิทธิ์ใน Settings → Safari → Camera แล้วลองใหม่"
          : /https/i.test(msg)
            ? "iOS ต้องการ HTTPS เท่านั้น (เว็บนี้เป็น HTTPS อยู่แล้ว — ลอง refresh)"
            : msg;
      setError(friendlyMsg);
      onError?.(friendlyMsg);
      setScanning(false);
      setStarting(false);
    }
  }

  async function stop() {
    const ref = scannerRef.current;
    if (ref) {
      try {
        await ref.stop();
        ref.clear();
      } catch {
        /* ignore */
      }
    }
    setScanning(false);
  }

  return (
    <div className="space-y-3">
      {/* Container always rendered (iOS compatibility) — visibility toggled */}
      <div
        className={`relative w-full max-w-sm mx-auto ${scanning ? "" : "hidden"}`}
      >
        <div
          id={containerId}
          className="w-full rounded-lg overflow-hidden bg-slate-900 aspect-square"
        />
      </div>

      {!scanning ? (
        <Button onClick={start} className="w-full" size="lg" disabled={starting}>
          <Camera className="mr-2 size-5" />
          {starting ? "กำลังเปิดกล้อง..." : "เปิดกล้องสแกน QR"}
        </Button>
      ) : (
        <Button onClick={stop} variant="outline" className="w-full" size="lg">
          <CameraOff className="mr-2 size-5" />
          ปิดกล้อง
        </Button>
      )}

      {error && (
        <div className="text-sm text-red-700 bg-red-50 border border-red-200 p-3 rounded space-y-1">
          <div className="font-medium">⚠️ ใช้กล้องไม่ได้</div>
          <div className="text-xs">{error}</div>
          <div className="text-xs text-muted-foreground mt-2">
            ทางแก้สำหรับ iOS:
            <ul className="list-disc list-inside mt-1 space-y-0.5">
              <li>Settings → Safari → Camera → Allow</li>
              <li>ปิด-เปิด Safari ใหม่</li>
              <li>ใช้ Safari (ไม่ใช่ in-app browser ของ Line/Facebook)</li>
            </ul>
          </div>
        </div>
      )}
    </div>
  );
}
