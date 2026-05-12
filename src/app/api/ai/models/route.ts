import { NextRequest, NextResponse } from "next/server";

// GET /api/ai/models?key=...
// Proxy to OpenRouter to fetch the model list with pricing.
// We don't keep the key — just forward and return the list.
// (Keys live in client localStorage, the client passes ?key= for this lookup.)
export async function GET(req: NextRequest) {
  const apiKey = req.nextUrl.searchParams.get("key");
  if (!apiKey) return NextResponse.json({ error: "missing ?key" }, { status: 400 });

  try {
    const res = await fetch("https://openrouter.ai/api/v1/models", {
      headers: { Authorization: `Bearer ${apiKey}` },
    });
    if (!res.ok) {
      const text = await res.text();
      return NextResponse.json({ error: `OpenRouter ${res.status}: ${text.slice(0,200)}` }, { status: res.status });
    }
    const data = await res.json() as { data?: Array<{
      id: string; name: string; pricing?: { prompt?: string; completion?: string }; context_length?: number; architecture?: { modality?: string };
    }> };

    const models = (data.data ?? [])
      .map((m) => {
        const promptCost = parseFloat(m.pricing?.prompt ?? "0");
        const completionCost = parseFloat(m.pricing?.completion ?? "0");
        const isFree = promptCost === 0 && completionCost === 0;
        const isVision = m.architecture?.modality?.includes("image") ?? false;
        // Cost summary in THB (approx — 35 THB/USD, per 1M tokens)
        let costSummary = "ฟรี";
        if (!isFree) {
          const promptThb = promptCost * 1_000_000 * 35;
          const completionThb = completionCost * 1_000_000 * 35;
          costSummary = `~${promptThb.toFixed(2)}฿ → / ${completionThb.toFixed(2)}฿ ←  (ต่อ 1M tokens)`;
        }
        return {
          id: m.id,
          name: m.name,
          is_free: isFree,
          is_vision: isVision,
          context_length: m.context_length,
          cost_summary_th: costSummary,
        };
      })
      // Sort: free first, then by name
      .sort((a, b) => {
        if (a.is_free !== b.is_free) return a.is_free ? -1 : 1;
        return a.name.localeCompare(b.name);
      });

    return NextResponse.json({ models, count: models.length });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "fetch failed" }, { status: 500 });
  }
}
