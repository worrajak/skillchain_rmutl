"use client";

import { useEffect, useState, useRef } from "react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { Send, FileCheck, Lock, Shield } from "lucide-react";

interface Message {
  id: string;
  sender_id: string;
  message_type: string;
  content: string;
  content_hash: string | null;
  on_chain_tx: string | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
  sender?: { name: string; role: string };
}

export function ChatRoom({ jobId, currentUserId }: { jobId: string; currentUserId: string }) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [isLocked, setIsLocked] = useState(false);
  const [roomId, setRoomId] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const supabase = createClient();

  useEffect(() => {
    async function load() {
      const res = await fetch(`/api/chat/${jobId}`);
      if (!res.ok) { setLoading(false); return; }
      const data = await res.json();
      setMessages(data.messages ?? []);
      setIsLocked(data.room?.is_locked ?? false);
      setRoomId(data.room?.id ?? null);
      setLoading(false);
    }
    load();
  }, [jobId]);

  // Realtime subscription
  useEffect(() => {
    if (!roomId) return;
    const channel = supabase
      .channel(`chat-${roomId}`)
      .on("postgres_changes", {
        event: "INSERT",
        schema: "public",
        table: "chat_messages",
        filter: `room_id=eq.${roomId}`,
      }, async (payload) => {
        // fetch sender info
        const { data: sender } = await supabase.from("skc_users").select("name, role").eq("id", (payload.new as Message).sender_id).single();
        setMessages((prev) => [...prev, { ...payload.new as Message, sender: sender ?? undefined }]);
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [roomId]);

  // Auto scroll
  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages]);

  async function handleSend(e: React.FormEvent) {
    e.preventDefault();
    if (!input.trim() || sending || isLocked) return;
    setSending(true);
    await fetch(`/api/chat/${jobId}/messages`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content: input, message_type: "TEXT" }),
    });
    setInput("");
    setSending(false);
  }

  if (loading) {
    return <div className="flex justify-center py-8"><div className="animate-spin size-6 border-4 border-blue-500 border-t-transparent rounded-full" /></div>;
  }

  const ROLE_COLORS: Record<string, string> = {
    student: "bg-blue-100 text-blue-800",
    employer: "bg-green-100 text-green-800",
    teacher: "bg-orange-100 text-orange-800",
    project_staff: "bg-purple-100 text-purple-800",
    rmutl_staff: "bg-indigo-100 text-indigo-800",
    admin: "bg-red-100 text-red-800",
  };

  return (
    <div className="flex flex-col h-[500px] rounded-xl border overflow-hidden bg-card">
      {/* Header */}
      <div className="flex items-center gap-2 border-b px-4 py-3 bg-muted/50">
        <Shield className="size-4 text-blue-600" />
        <span className="font-semibold text-sm text-foreground">แชทงาน</span>
        {isLocked && <span className="ml-auto flex items-center gap-1 text-xs text-muted-foreground"><Lock className="size-3" />ล็อค</span>}
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {messages.map((m) => {
          const isMe = m.sender_id === currentUserId;
          const isAgreement = m.message_type === "AGREEMENT" || m.message_type === "AGREEMENT_ACK";
          const isSystem = m.message_type === "SYSTEM";

          if (isSystem) {
            return (
              <div key={m.id} className="text-center text-xs text-muted-foreground py-1">
                {m.content}
              </div>
            );
          }

          return (
            <div key={m.id} className={cn("flex", isMe ? "justify-end" : "justify-start")}>
              <div className={cn("max-w-[75%] rounded-xl px-3 py-2 text-sm", isMe ? "bg-blue-600 text-white" : "bg-muted text-foreground")}>
                {!isMe && (
                  <div className="flex items-center gap-1.5 mb-1">
                    <span className="font-medium text-xs">{m.sender?.name ?? "?"}</span>
                    <span className={cn("inline-flex rounded-full px-1.5 py-0.5 text-[9px] font-medium", ROLE_COLORS[m.sender?.role ?? ""] ?? "bg-gray-100")}>
                      {m.sender?.role}
                    </span>
                  </div>
                )}
                {isAgreement && (
                  <div className={cn("flex items-center gap-1 text-xs mb-1", isMe ? "text-blue-200" : "text-amber-700")}>
                    <FileCheck className="size-3" />
                    <span className="font-medium">ข้อตกลง</span>
                    {m.content_hash && <span className="font-mono text-[9px] opacity-70">#{m.content_hash.slice(0, 8)}</span>}
                  </div>
                )}
                <div className="whitespace-pre-wrap break-words">{m.content}</div>
                <div className={cn("text-[10px] mt-1", isMe ? "text-blue-200" : "text-muted-foreground")}>
                  {new Date(m.created_at).toLocaleTimeString("th-TH", { hour: "2-digit", minute: "2-digit" })}
                </div>
              </div>
            </div>
          );
        })}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      {!isLocked ? (
        <form onSubmit={handleSend} className="flex gap-2 border-t p-3">
          <Input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="พิมพ์ข้อความ..."
            className="flex-1"
          />
          <Button type="submit" size="sm" disabled={!input.trim() || sending}>
            <Send className="size-4" />
          </Button>
        </form>
      ) : (
        <div className="flex items-center justify-center gap-2 border-t py-3 text-sm text-muted-foreground">
          <Lock className="size-4" />ห้อง chat ถูกล็อคแล้ว
        </div>
      )}
    </div>
  );
}
