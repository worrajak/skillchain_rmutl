"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { FileSearch, Heart, Calendar } from "lucide-react";

export default function DonorAuditPage() {
  const [donations, setDonations] = useState<Record<string, unknown>[]>([]);
  const [totalAmount, setTotalAmount] = useState(0);
  const [loading, setLoading] = useState(true);
  const supabase = createClient();

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setLoading(false); return; }

      const { data } = await supabase.from("donation_funds")
        .select("*")
        .eq("donor_id", user.id)
        .order("created_at", { ascending: false });

      setDonations(data ?? []);
      setTotalAmount((data ?? []).reduce((sum, d) => sum + Number(d.amount), 0));
      setLoading(false);
    }
    load();
  }, []);

  return (
    <div className="space-y-4">
      <Card className="bg-gradient-to-br from-pink-500 to-rose-600 text-white">
        <CardContent className="flex items-center gap-4 pt-6 pb-6">
          <Heart className="size-10" />
          <div>
            <div className="text-3xl font-bold">{totalAmount.toLocaleString()} TRX</div>
            <div className="text-sm opacity-90">บริจาคทั้งหมด ({donations.length} ครั้ง)</div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-foreground flex items-center gap-2">
            <FileSearch className="size-5" />ประวัติการบริจาค
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex justify-center py-8"><div className="animate-spin size-6 border-4 border-pink-500 border-t-transparent rounded-full" /></div>
          ) : donations.length > 0 ? (
            <div className="space-y-3">
              {donations.map((d) => (
                <div key={String(d.id)} className="flex items-center justify-between rounded-lg border p-3">
                  <div>
                    <div className="font-medium text-sm text-foreground">{String(d.purpose)}</div>
                    <div className="flex items-center gap-1 text-xs text-muted-foreground mt-0.5">
                      <Calendar className="size-3" />
                      {new Date(String(d.created_at)).toLocaleDateString("th-TH")}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="font-bold text-foreground">{Number(d.amount).toLocaleString()} TRX</div>
                    {d.nft_tx_hash ? (
                      <div className="text-[10px] text-green-600 font-mono">{String(d.nft_tx_hash).slice(0, 12)}...</div>
                    ) : (
                      <div className="text-[10px] text-muted-foreground">รอบันทึก on-chain</div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-center text-muted-foreground py-8">ยังไม่มีประวัติการบริจาค</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
