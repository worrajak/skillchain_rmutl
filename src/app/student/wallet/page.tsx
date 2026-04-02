"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Wallet, Link2, ExternalLink, AlertTriangle } from "lucide-react";
import { toast } from "sonner";

export default function StudentWalletPage() {
  const [walletAddress, setWalletAddress] = useState<string | null>(null);
  const [connecting, setConnecting] = useState(false);

  const supabase = createClient();

  async function handleConnect() {
    setConnecting(true);

    // Check TronLink
    const tronWeb = (window as Record<string, unknown>).tronWeb as Record<string, unknown> | undefined;
    if (!tronWeb || !tronWeb.defaultAddress) {
      toast.error("กรุณาติดตั้ง TronLink extension ก่อน");
      setConnecting(false);
      return;
    }

    const address = (tronWeb.defaultAddress as Record<string, string>).base58;
    if (!address) {
      toast.error("กรุณา unlock TronLink ก่อน");
      setConnecting(false);
      return;
    }

    // Save to DB
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { toast.error("กรุณาเข้าสู่ระบบ"); setConnecting(false); return; }

    const { error } = await supabase.from("users").update({ wallet_address: address }).eq("id", user.id);
    setConnecting(false);

    if (!error) {
      setWalletAddress(address);
      toast.success("เชื่อมต่อ Wallet สำเร็จ");
    } else {
      toast.error(error.message);
    }
  }

  return (
    <div className="max-w-lg mx-auto space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-foreground flex items-center gap-2">
            <Wallet className="size-5" />
            TRON Wallet
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {walletAddress ? (
            <div className="space-y-3">
              <div className="rounded-lg bg-green-50 border border-green-200 p-4">
                <p className="text-sm text-green-800 font-medium mb-1">เชื่อมต่อแล้ว</p>
                <p className="text-xs font-mono text-green-700 break-all">{walletAddress}</p>
              </div>
              <Button variant="outline" size="sm" className="w-full" asChild>
                <a href={`https://nile.tronscan.org/#/address/${walletAddress}`} target="_blank" rel="noopener noreferrer">
                  ดูบน TronScan <ExternalLink className="size-3 ml-1" />
                </a>
              </Button>
            </div>
          ) : (
            <div className="text-center space-y-4 py-4">
              <Wallet className="size-16 mx-auto text-muted-foreground/30" />
              <div>
                <p className="font-medium text-foreground">ยังไม่ได้เชื่อมต่อ Wallet</p>
                <p className="text-sm text-muted-foreground mt-1">เชื่อมต่อ TronLink เพื่อรับเงินจากงานจ้างผ่าน Escrow</p>
              </div>
              <Button onClick={handleConnect} disabled={connecting} className="w-full">
                <Link2 className="size-4 mr-2" />
                {connecting ? "กำลังเชื่อมต่อ..." : "เชื่อมต่อ TronLink"}
              </Button>
            </div>
          )}

          <div className="rounded-lg bg-yellow-50 border border-yellow-200 p-3">
            <div className="flex items-start gap-2">
              <AlertTriangle className="size-4 text-yellow-600 mt-0.5 shrink-0" />
              <div className="text-xs text-yellow-800">
                <p className="font-medium">TRON Nile Testnet</p>
                <p className="mt-0.5">ระบบใช้ Testnet สำหรับทดสอบ — ไม่มีค่าใช้จ่ายจริง</p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
