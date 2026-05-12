"use client";

import { useRef, useState } from "react";
import { Camera, Sparkles, Loader2, Check, X, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { fetchAI, userHasAnyKey } from "@/lib/ai/user-keys";
import { toast } from "sonner";

/**
 * AIJobEstimator — Employer ถ่ายรูปอุปกรณ์/พื้นที่ → AI ประเมินงานให้
 *
 * ส่ง back ค่าผ่าน onApply เพื่อให้ form parent กรอกฟอร์มอัตโนมัติ:
 *   { title, description, category, suggestedPay (mid of min/max), hours }
 */

export interface AIJobEstimate {
  title: string;
  description: string;
  category: "electrical" | "hvac" | "automotive" | "general";
  estimated_pay_min: number;
  estimated_pay_max: number;
  estimated_hours: number;
  scope_items: string[];
  cautions: string[];
}

interface AIJobEstimatorProps {
  onApply: (e: AIJobEstimate) => void;
}

export function AIJobEstimator({ onApply }: AIJobEstimatorProps) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [images, setImages] = useState<{ dataUrl: string; file: File }[]>([]);
  const [loading, setLoading] = useState(false);
  const [estimate, setEstimate] = useState<AIJobEstimate | null>(null);
  const [hasAIKey, setHasAIKey] = useState(false);

  // Defer key check to client mount
  useState(() => {
    if (typeof window !== "undefined") setHasAIKey(userHasAnyKey());
  });

  async function pickFiles(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []).slice(0, 3);
    const next: { dataUrl: string; file: File }[] = [];
    for (const f of files) {
      const dataUrl = await new Promise<string>((res) => {
        const r = new FileReader();
        r.onload = () => res(r.result as string);
        r.readAsDataURL(f);
      });
      next.push({ dataUrl, file: f });
    }
    setImages(next);
    e.target.value = "";
    if (next.length > 0) analyze(next);
  }

  async function analyze(imgs: { dataUrl: string }[]) {
    setLoading(true);
    setEstimate(null);
    try {
      const res = await fetchAI("/api/ai/job-estimate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ images: imgs.map((i) => i.dataUrl) }),
      });
      const data = await res.json();
      if (!data.ok) {
        toast.error(data.error || "AI ประเมินไม่สำเร็จ");
        return;
      }
      setEstimate(data as AIJobEstimate);
    } finally {
      setLoading(false);
    }
  }

  if (!hasAIKey) {
    return (
      <Card className="border-amber-200 bg-amber-50">
        <CardContent className="pt-4 text-sm space-y-2">
          <p className="font-medium text-amber-900 flex items-center gap-1">
            <Sparkles className="size-4" />
            ✨ ใช้ AI ช่วยกรอกฟอร์ม
          </p>
          <p className="text-amber-800 text-xs">
            ถ่ายรูปอุปกรณ์ที่ต้องซ่อม → AI จะกรอกหัวข้อ/รายละเอียด/ค่าจ้างให้อัตโนมัติ
          </p>
          <a
            href="/settings/ai"
            className="inline-flex items-center gap-1 text-xs text-amber-700 hover:underline mt-1"
          >
            → ตั้งค่า OpenRouter API key ก่อน
          </a>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-sky-200 bg-gradient-to-br from-sky-50 to-blue-50">
      <CardContent className="pt-4 space-y-3">
        <div className="flex items-center gap-2">
          <Sparkles className="size-5 text-amber-500" />
          <p className="font-semibold text-sm">AI Job Estimator</p>
        </div>
        <p className="text-xs text-muted-foreground">
          ถ่ายรูปอุปกรณ์ที่ต้องการให้ช่างมาดูแล (เช่น แอร์ผนัง, ปลั๊กไฟ, รถ) → AI จะกรอกหัวข้องาน/ราคาให้คุณ
        </p>

        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          capture="environment"
          multiple
          className="hidden"
          onChange={pickFiles}
        />

        <Button
          onClick={() => fileRef.current?.click()}
          disabled={loading}
          className="w-full bg-sky-500 hover:bg-sky-600 text-white"
        >
          {loading ? (
            <>
              <Loader2 className="size-4 mr-2 animate-spin" />
              กำลังวิเคราะห์...
            </>
          ) : (
            <>
              <Camera className="size-4 mr-2" />
              📷 ถ่ายรูป / เลือกจากคลัง (สูงสุด 3 รูป)
            </>
          )}
        </Button>

        {images.length > 0 && (
          <div className="grid grid-cols-3 gap-2">
            {images.map((img, i) => (
              // eslint-disable-next-line @next/next/no-img-element
              <img key={i} src={img.dataUrl} alt="" className="aspect-square rounded object-cover border" />
            ))}
          </div>
        )}

        {estimate && (
          <div className="rounded-lg bg-white border border-sky-200 p-3 space-y-2 text-sm">
            <p className="font-semibold text-sky-900 flex items-center gap-1">
              <Sparkles className="size-4 text-amber-500" />
              AI แนะนำ:
            </p>
            <div>
              <p className="font-medium">{estimate.title}</p>
              <p className="text-xs text-muted-foreground mt-0.5">{estimate.description}</p>
            </div>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div>
                <p className="text-muted-foreground">หมวด</p>
                <p className="font-medium">{estimate.category}</p>
              </div>
              <div>
                <p className="text-muted-foreground">เวลาประเมิน</p>
                <p className="font-medium">{estimate.estimated_hours} ชม.</p>
              </div>
              <div className="col-span-2">
                <p className="text-muted-foreground">ค่าจ้างประเมิน</p>
                <p className="font-bold text-emerald-700 text-base">
                  {estimate.estimated_pay_min.toLocaleString()} - {estimate.estimated_pay_max.toLocaleString()} TRPB
                </p>
              </div>
            </div>
            {estimate.scope_items?.length > 0 && (
              <div className="text-xs">
                <p className="text-muted-foreground mb-1">งานย่อย:</p>
                <ul className="list-disc list-inside space-y-0.5">
                  {estimate.scope_items.map((s, i) => <li key={i}>{s}</li>)}
                </ul>
              </div>
            )}
            {estimate.cautions?.length > 0 && (
              <div className="rounded-md bg-amber-50 border border-amber-200 p-2 text-xs text-amber-800">
                <p className="font-medium flex items-center gap-1 mb-1">
                  <AlertTriangle className="size-3" />
                  ข้อควรระวัง
                </p>
                <ul className="list-disc list-inside space-y-0.5">
                  {estimate.cautions.map((c, i) => <li key={i}>{c}</li>)}
                </ul>
              </div>
            )}
            <div className="flex gap-2 pt-1">
              <Button
                onClick={() => onApply(estimate)}
                size="sm"
                className="flex-1 bg-emerald-500 hover:bg-emerald-600 text-white"
              >
                <Check className="size-4 mr-1" />
                ใช้ค่านี้ — กรอกฟอร์มให้
              </Button>
              <Button
                onClick={() => { setEstimate(null); setImages([]); }}
                size="sm"
                variant="outline"
              >
                <X className="size-4" />
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
