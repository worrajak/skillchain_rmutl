import { NextRequest, NextResponse } from "next/server";
import QRCode from "qrcode";

/**
 * GET /api/qr?text=...&size=200
 * Returns a PNG QR code for the given text.
 * Used by the guide PDFs (download + app links).
 */
export async function GET(req: NextRequest) {
  const text = req.nextUrl.searchParams.get("text");
  const size = Number(req.nextUrl.searchParams.get("size") ?? 240);
  if (!text) return NextResponse.json({ error: "missing text" }, { status: 400 });

  try {
    const buffer = await QRCode.toBuffer(text, {
      width: Math.min(800, Math.max(80, size)),
      margin: 2,
      color: { dark: "#0c4a6e", light: "#ffffff" },
      errorCorrectionLevel: "M",
    });
    return new NextResponse(buffer as unknown as BodyInit, {
      headers: {
        "Content-Type": "image/png",
        "Cache-Control": "public, max-age=86400, s-maxage=86400",
      },
    });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "QR generation failed" }, { status: 500 });
  }
}
