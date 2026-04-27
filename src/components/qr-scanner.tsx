"use client";

import { useEffect, useRef, useState } from "react";
import { Html5Qrcode } from "html5-qrcode";
import { Button } from "@/components/ui/button";
import { Camera, CameraOff } from "lucide-react";

interface QrScannerProps {
  onScan: (decoded: string) => void;
  onError?: (err: string) => void;
}

export default function QrScanner({ onScan, onError }: QrScannerProps) {
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const containerId = "qr-scanner-container";
  const [scanning, setScanning] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    return () => {
      // Cleanup on unmount
      if (scannerRef.current && scanning) {
        scannerRef.current.stop().catch(() => {});
      }
    };
  }, [scanning]);

  async function start() {
    try {
      setError(null);
      if (!scannerRef.current) {
        scannerRef.current = new Html5Qrcode(containerId);
      }

      await scannerRef.current.start(
        { facingMode: "environment" }, // back camera
        {
          fps: 10,
          qrbox: { width: 250, height: 250 },
        },
        (decoded) => {
          // Success
          onScan(decoded);
          stop();
        },
        () => {
          // Frame failure (silent)
        }
      );

      setScanning(true);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "ไม่สามารถเปิดกล้องได้";
      setError(msg);
      onError?.(msg);
    }
  }

  async function stop() {
    if (scannerRef.current && scanning) {
      try {
        await scannerRef.current.stop();
        scannerRef.current.clear();
      } catch {}
      setScanning(false);
    }
  }

  return (
    <div className="space-y-3">
      <div
        id={containerId}
        className="w-full max-w-sm mx-auto rounded-lg overflow-hidden bg-slate-900 aspect-square"
        style={{ display: scanning ? "block" : "none" }}
      />

      {!scanning ? (
        <Button onClick={start} className="w-full" size="lg">
          <Camera className="mr-2 size-5" />
          เปิดกล้องสแกน QR
        </Button>
      ) : (
        <Button onClick={stop} variant="outline" className="w-full" size="lg">
          <CameraOff className="mr-2 size-5" />
          ปิดกล้อง
        </Button>
      )}

      {error && (
        <div className="text-sm text-red-600 bg-red-50 p-3 rounded">
          ⚠️ {error}
        </div>
      )}
    </div>
  );
}
