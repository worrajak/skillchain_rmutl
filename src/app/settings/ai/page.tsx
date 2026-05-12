"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  ArrowLeft,
  CheckCircle2,
  Eye,
  EyeOff,
  Download,
  Upload,
  TestTube,
  Loader2,
  Sparkles,
  Mic,
  AlertTriangle,
} from "lucide-react";
import {
  getUserKeys,
  setUserKey,
  clearUserKey,
  getUserPrefs,
  setUserPrefs,
  exportAIConfig,
  importAIConfig,
  subscribeToAIConfig,
  type UserAIPrefs,
} from "@/lib/ai/user-keys";
import { toast } from "sonner";

interface ModelOption {
  id: string;
  name: string;
  is_free: boolean;
  is_vision: boolean;
  context_length?: number;
  cost_summary_th: string;
}

export default function AISettingsPage() {
  const [orKey, setOrKey] = useState("");
  const [showKey, setShowKey] = useState(false);
  const [keyExists, setKeyExists] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ ok: boolean; message?: string; count?: number } | null>(null);
  const [models, setModels] = useState<ModelOption[]>([]);
  const [loadingModels, setLoadingModels] = useState(false);
  const [prefs, setPrefsState] = useState<UserAIPrefs>(() => ({ default_provider: "openrouter" }));
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Load on mount + on storage changes
  useEffect(() => {
    function reload() {
      const keys = getUserKeys();
      setKeyExists(!!keys.openrouter);
      // Show masked version: last 4 chars
      if (keys.openrouter) setOrKey(keys.openrouter);
      setPrefsState(getUserPrefs());
    }
    reload();
    return subscribeToAIConfig(reload);
  }, []);

  async function handleTest() {
    if (!orKey.trim()) {
      toast.error("กรุณาใส่ API key ก่อน");
      return;
    }
    setTesting(true);
    setTestResult(null);
    try {
      const res = await fetch("/api/ai/test-key", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ provider: "openrouter", apiKey: orKey.trim() }),
      });
      const data = await res.json();
      if (data.ok) {
        setTestResult({ ok: true, message: `เชื่อมต่อ OpenRouter สำเร็จ`, count: data.model_count });
        toast.success(`✅ Key ใช้งานได้ — มี ${data.model_count} รุ่น AI`);
      } else {
        setTestResult({ ok: false, message: data.error });
        toast.error(`❌ ${data.error}`);
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : "ทดสอบไม่สำเร็จ";
      setTestResult({ ok: false, message: msg });
      toast.error(msg);
    } finally {
      setTesting(false);
    }
  }

  async function handleSave() {
    if (!orKey.trim()) {
      toast.error("กรุณาใส่ API key ก่อนบันทึก");
      return;
    }
    setUserKey("openrouter", orKey.trim());
    toast.success("บันทึก OpenRouter API key แล้ว");
    setKeyExists(true);
    // Auto-load models after save
    loadModels();
  }

  function handleClear() {
    if (!confirm("ลบ OpenRouter API key ออกจากเครื่องนี้?")) return;
    clearUserKey("openrouter");
    setOrKey("");
    setKeyExists(false);
    setTestResult(null);
    setModels([]);
    toast.success("ลบ key แล้ว");
  }

  async function loadModels() {
    if (!orKey.trim()) return;
    setLoadingModels(true);
    try {
      const res = await fetch(`/api/ai/models?key=${encodeURIComponent(orKey.trim())}`);
      const data = await res.json();
      if (data.models) setModels(data.models);
    } catch (e) {
      console.error(e);
    } finally {
      setLoadingModels(false);
    }
  }

  // Auto-load models when key is set on mount
  useEffect(() => {
    if (keyExists && orKey && models.length === 0) {
      loadModels();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [keyExists]);

  function updatePref(patch: Partial<UserAIPrefs>) {
    setUserPrefs(patch);
    setPrefsState(getUserPrefs());
    toast.success("บันทึกการตั้งค่าแล้ว");
  }

  function handleExport() {
    const json = exportAIConfig();
    const blob = new Blob([json], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    const ts = new Date().toISOString().slice(0, 10);
    a.href = url;
    a.download = `skillchain-ai-config-${ts}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast.success("📥 Export ค่า AI เป็น JSON เสร็จ");
  }

  function handleImportClick() {
    fileInputRef.current?.click();
  }

  async function handleFileChosen(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const text = await file.text();
    const error = importAIConfig(text);
    if (error) {
      toast.error(`Import ไม่สำเร็จ: ${error}`);
    } else {
      toast.success("✅ Import ค่า AI สำเร็จ");
    }
    // Reset input so same file can be chosen again
    e.target.value = "";
  }

  // Filter to vision-capable models for the vision picker
  const visionModels = models.filter((m) => m.is_vision);
  const allModels = models;

  return (
    <div className="container max-w-2xl mx-auto px-4 py-6 space-y-6">
      <div className="flex items-center gap-2">
        <Link href="/">
          <Button variant="ghost" size="sm">
            <ArrowLeft className="size-4 mr-1" />
            กลับ
          </Button>
        </Link>
        <h1 className="text-xl font-bold">การตั้งค่า AI</h1>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Sparkles className="size-5 text-amber-500" />
            OpenRouter API Key (BYOK)
          </CardTitle>
          <CardDescription>
            ใช้ key ของคุณเอง — ค่าใช้จ่ายตามที่ใช้จริง ไม่ได้เก็บบน server
            <br />
            <a
              href="https://openrouter.ai/settings/keys"
              target="_blank"
              rel="noopener noreferrer"
              className="text-sky-600 hover:underline"
            >
              สร้าง key ที่ openrouter.ai/settings/keys →
            </a>
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="or-key">API Key</Label>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Input
                  id="or-key"
                  type={showKey ? "text" : "password"}
                  placeholder="sk-or-v1-..."
                  value={orKey}
                  onChange={(e) => setOrKey(e.target.value)}
                  className="pr-10 font-mono text-sm"
                />
                <button
                  type="button"
                  onClick={() => setShowKey(!showKey)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  aria-label={showKey ? "ซ่อน" : "แสดง"}
                >
                  {showKey ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                </button>
              </div>
            </div>
            {keyExists && (
              <p className="text-xs text-emerald-600 flex items-center gap-1">
                <CheckCircle2 className="size-3" />
                Key อยู่ในเครื่องนี้แล้ว
              </p>
            )}
          </div>

          {testResult && (
            <div
              className={`text-sm rounded-md p-3 ${
                testResult.ok
                  ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                  : "bg-red-50 text-red-700 border border-red-200"
              }`}
            >
              {testResult.message}
              {testResult.count !== undefined && ` (รุ่น AI: ${testResult.count})`}
            </div>
          )}

          <div className="flex gap-2 flex-wrap">
            <Button onClick={handleTest} disabled={testing || !orKey.trim()} variant="outline">
              {testing ? <Loader2 className="size-4 mr-1 animate-spin" /> : <TestTube className="size-4 mr-1" />}
              ทดสอบ key
            </Button>
            <Button onClick={handleSave} disabled={!orKey.trim()}>
              บันทึก key
            </Button>
            {keyExists && (
              <Button onClick={handleClear} variant="ghost" className="text-red-600 hover:text-red-700">
                ลบ key
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Model selection — only show when models loaded */}
      {keyExists && (
        <Card>
          <CardHeader>
            <CardTitle>โมเดล AI ที่ใช้งาน</CardTitle>
            <CardDescription>
              เลือกโมเดลที่จะใช้สำหรับงานทั่วไป (chat, สรุป, แนะนำ) และงานที่ต้องดูภาพ (vision)
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {loadingModels ? (
              <div className="text-center py-6 text-muted-foreground">
                <Loader2 className="size-5 mx-auto mb-2 animate-spin" />
                กำลังโหลดรายการโมเดล...
              </div>
            ) : allModels.length === 0 ? (
              <Button onClick={loadModels} variant="outline" className="w-full">
                โหลดรายการโมเดล
              </Button>
            ) : (
              <>
                <div className="space-y-2">
                  <Label htmlFor="default-model">โมเดลหลัก ({allModels.length} รุ่น)</Label>
                  <select
                    id="default-model"
                    value={prefs.default_model || ""}
                    onChange={(e) => updatePref({ default_model: e.target.value })}
                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sky-400"
                  >
                    <option value="">-- เลือกโมเดล --</option>
                    {allModels.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.is_free ? "🆓 " : ""}
                        {m.is_vision ? "👁 " : ""}
                        {m.name} — {m.cost_summary_th}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="vision-model">โมเดลสำหรับวิเคราะห์ภาพ ({visionModels.length} รุ่นรองรับ)</Label>
                  <select
                    id="vision-model"
                    value={prefs.vision_model || ""}
                    onChange={(e) => updatePref({ vision_model: e.target.value })}
                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sky-400"
                  >
                    <option value="">-- ใช้โมเดลหลัก --</option>
                    {visionModels.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.is_free ? "🆓 " : ""}
                        {m.name} — {m.cost_summary_th}
                      </option>
                    ))}
                  </select>
                  <p className="text-xs text-muted-foreground">
                    ใช้สำหรับ: ถ่ายรูปงาน → AI สรุป, ตรวจคุณภาพ before/after, AI Job Estimator
                  </p>
                </div>

                <Button onClick={loadModels} variant="ghost" size="sm" className="w-full">
                  🔄 โหลดรายการโมเดลใหม่
                </Button>
              </>
            )}
          </CardContent>
        </Card>
      )}

      {/* Voice toggle */}
      {keyExists && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Mic className="size-5 text-sky-500" />
              เสียง → ข้อความ
            </CardTitle>
            <CardDescription>
              ใช้ MediaRecorder ของ browser อัดเสียง แล้วถอดด้วยโมเดลของ OpenRouter (whisper-1, llama-3-whisper, ฯลฯ)
            </CardDescription>
          </CardHeader>
          <CardContent>
            <label className="flex items-center gap-3">
              <input
                type="checkbox"
                checked={prefs.enable_voice ?? false}
                onChange={(e) => updatePref({ enable_voice: e.target.checked })}
                className="size-5 rounded"
              />
              <span className="text-sm">เปิดปุ่ม voice ในหน้า submit งาน + comment</span>
            </label>
          </CardContent>
        </Card>
      )}

      {/* Backup */}
      <Card>
        <CardHeader>
          <CardTitle>สำรอง / นำเข้า การตั้งค่า</CardTitle>
          <CardDescription>
            Export เป็นไฟล์ JSON เก็บไว้ — ใส่ key + model ที่เลือก. นำเข้าได้เครื่องอื่น/browser อื่น
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex gap-2 flex-wrap">
            <Button onClick={handleExport} variant="outline">
              <Download className="size-4 mr-1" />
              Export เป็น JSON
            </Button>
            <Button onClick={handleImportClick} variant="outline">
              <Upload className="size-4 mr-1" />
              Import จาก JSON
            </Button>
            <input
              ref={fileInputRef}
              type="file"
              accept="application/json"
              className="hidden"
              onChange={handleFileChosen}
            />
          </div>
          <div className="rounded-md bg-amber-50 border border-amber-200 p-3 text-xs text-amber-800 flex gap-2">
            <AlertTriangle className="size-4 shrink-0" />
            <span>
              ไฟล์ JSON มี API key แท้ — เก็บในที่ปลอดภัย อย่าส่งให้คนอื่น/upload ที่สาธารณะ
            </span>
          </div>
        </CardContent>
      </Card>

      <Card className="bg-muted/50">
        <CardContent className="pt-6 space-y-2 text-xs text-muted-foreground">
          <p>📌 <strong>Privacy:</strong> Key เก็บใน browser คุณเท่านั้น (localStorage) — server ไม่ persist</p>
          <p>📌 <strong>Cost:</strong> ค่าใช้ AI หักจาก credit ใน OpenRouter ของคุณโดยตรง</p>
          <p>📌 <strong>Switch device:</strong> ใช้ Export/Import ย้ายค่าระหว่างเครื่อง</p>
        </CardContent>
      </Card>
    </div>
  );
}
