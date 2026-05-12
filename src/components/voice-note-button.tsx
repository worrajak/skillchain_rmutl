"use client";

import { useEffect, useRef, useState } from "react";
import { Mic, MicOff, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

/**
 * VoiceNoteButton — adds a microphone button next to a textarea.
 * When clicked, opens Web Speech API recognition (browser-native).
 *
 * Result appends to the textarea via the onTranscript callback.
 *
 * Supports Thai (lang="th-TH"). Works on iOS Safari 14.5+ and Android Chrome.
 * Falls back to "browser ไม่รองรับ" message if API not available.
 *
 * No server round-trip, no API key needed — uses on-device speech recognition.
 */

interface VoiceNoteButtonProps {
  onTranscript: (text: string) => void;
  lang?: string;
  size?: "sm" | "default";
  className?: string;
}

// Type augmentation for browser Speech API
interface SpeechRecognition extends EventTarget {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  start(): void;
  stop(): void;
  onresult: ((e: SpeechRecognitionEvent) => void) | null;
  onerror: ((e: { error: string }) => void) | null;
  onend: (() => void) | null;
}
interface SpeechRecognitionEvent {
  results: ArrayLike<{
    isFinal: boolean;
    [index: number]: { transcript: string };
  }>;
  resultIndex: number;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function getSpeechRecognitionClass(): any {
  if (typeof window === "undefined") return null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
}

export function VoiceNoteButton({
  onTranscript,
  lang = "th-TH",
  size = "sm",
  className,
}: VoiceNoteButtonProps) {
  const [recording, setRecording] = useState(false);
  const [supported, setSupported] = useState<boolean | null>(null);
  const recognitionRef = useRef<SpeechRecognition | null>(null);

  useEffect(() => {
    setSupported(!!getSpeechRecognitionClass());
  }, []);

  function start() {
    const SR = getSpeechRecognitionClass();
    if (!SR) {
      toast.error("Browser ไม่รองรับการบันทึกเสียง — ลองใช้ Chrome / Safari บนมือถือ");
      return;
    }

    const r = new SR() as SpeechRecognition;
    r.lang = lang;
    r.continuous = false;
    r.interimResults = false;

    r.onresult = (e) => {
      let finalText = "";
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const result = e.results[i];
        if (result.isFinal) finalText += result[0].transcript;
      }
      if (finalText.trim()) onTranscript(finalText.trim() + " ");
    };

    r.onerror = (e) => {
      if (e.error === "no-speech") {
        toast.error("ไม่ได้ยินเสียง — ลองพูดอีกครั้ง");
      } else if (e.error === "not-allowed") {
        toast.error("กรุณาอนุญาตให้ใช้ไมโครโฟน");
      } else if (e.error !== "aborted") {
        toast.error(`บันทึกเสียงไม่สำเร็จ: ${e.error}`);
      }
      setRecording(false);
    };

    r.onend = () => setRecording(false);

    try {
      r.start();
      recognitionRef.current = r;
      setRecording(true);
    } catch (e) {
      toast.error("เริ่มบันทึกไม่สำเร็จ");
      console.error(e);
      setRecording(false);
    }
  }

  function stop() {
    recognitionRef.current?.stop();
    setRecording(false);
  }

  // Hide if browser doesn't support
  if (supported === false) return null;

  return (
    <Button
      type="button"
      size={size}
      variant={recording ? "destructive" : "outline"}
      onClick={recording ? stop : start}
      className={cn(
        "shrink-0",
        recording && "animate-pulse",
        className,
      )}
      aria-label={recording ? "หยุดบันทึก" : "บันทึกเสียง"}
    >
      {supported === null ? (
        <Loader2 className="size-4 animate-spin" />
      ) : recording ? (
        <>
          <MicOff className="size-4 mr-1" />
          หยุด
        </>
      ) : (
        <>
          <Mic className="size-4 mr-1" />
          พูด
        </>
      )}
    </Button>
  );
}
