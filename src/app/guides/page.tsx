/**
 * Public /guides — hub page with QR codes + download links for all role guides.
 * Shareable URL: https://skillchain-rmutl.vercel.app/guides
 */

import Link from "next/link";
import { GUIDES } from "@/lib/guides-content";

export const dynamic = "force-static";

export const metadata = {
  title: "คู่มือการใช้งาน · SkillChain RMUTL",
  description:
    "ดาวน์โหลดคู่มือการใช้งาน SkillChain RMUTL — สำหรับนักศึกษา ผู้จ้างงาน คณะทำงานใต้ร่มฯ คณะทำงาน มทร. และอาจารย์",
};

const APP_URL =
  process.env.NEXT_PUBLIC_APP_URL || "https://skillchain-rmutl.vercel.app";

export default function GuidesHubPage() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-sky-50 to-white">
      <div className="container max-w-5xl mx-auto px-4 py-10 md:py-16">
        {/* Header */}
        <div className="text-center mb-10">
          <h1 className="text-3xl md:text-4xl font-bold text-sky-900 mb-2">
            📚 คู่มือการใช้งาน
          </h1>
          <p className="text-lg text-slate-700">
            ดาวน์โหลด PDF ขนาด 1 หน้า A4 — มีรูปประกอบ + QR เข้าระบบ
          </p>
          <p className="text-sm text-slate-500 mt-2">
            สแกน QR ในเล่มเพื่อเข้าสู่ระบบ หรือดาวน์โหลดเล่มอื่นได้
          </p>
        </div>

        {/* Cards grid */}
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {GUIDES.map((g) => {
            const pdfUrl = `${APP_URL}/guides/${g.slug}.pdf`;
            return (
              <div
                key={g.slug}
                className={`rounded-xl border-2 ${g.bg} p-5 shadow-sm hover:shadow-md transition-shadow`}
              >
                <div className="flex items-start justify-between mb-3">
                  <div className="text-4xl">{g.emoji}</div>
                  {g.canCreateJobs && (
                    <span className="text-[10px] rounded-full bg-emerald-100 text-emerald-700 px-2 py-0.5 font-medium">
                      สร้างงานได้
                    </span>
                  )}
                </div>
                <h2 className={`text-xl font-bold ${g.color} mb-1`}>
                  {g.roleLabel}
                </h2>
                <p className="text-sm text-slate-700 mb-4 leading-snug">
                  {g.tagline}
                </p>

                {/* QR + download */}
                <div className="flex items-center gap-3 mb-3">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={`/api/qr?text=${encodeURIComponent(pdfUrl)}&size=140`}
                    alt={`QR ดาวน์โหลดคู่มือ ${g.roleLabel}`}
                    className="size-24 rounded-md border bg-white"
                  />
                  <div className="flex-1 text-xs text-slate-600">
                    <p className="font-medium text-slate-700 mb-1">📲 สแกนเพื่อดาวน์โหลด</p>
                    <p>หรือกดปุ่มด้านล่าง</p>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <a
                    href={`/guides/${g.slug}.pdf`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={`flex items-center justify-center gap-2 w-full rounded-md px-3 py-2 text-sm font-semibold bg-white border ${g.color} hover:bg-slate-50`}
                  >
                    ⬇️ ดาวน์โหลด PDF
                  </a>
                  <Link
                    href={`/guides/${g.slug}/preview`}
                    className="flex items-center justify-center gap-2 w-full rounded-md px-3 py-1.5 text-xs text-slate-600 hover:bg-slate-50"
                  >
                    👁 ดูตัวอย่างในเว็บ
                  </Link>
                </div>
              </div>
            );
          })}
        </div>

        {/* Footer */}
        <div className="mt-10 text-center text-xs text-slate-500 space-y-1">
          <p>
            <strong>SkillChain RMUTL</strong> · โครงการใต้ร่มพระบารมี ·
            มหาวิทยาลัยเทคโนโลยีราชมงคลล้านนา
          </p>
          <p>
            📧 worrajak@rmutl.ac.th · 🔗{" "}
            <a href={APP_URL} className="text-sky-600 hover:underline">
              skillchain-rmutl.vercel.app
            </a>
          </p>
          <p className="text-[10px] text-slate-400 mt-2">
            คู่มือเวอร์ชั่น 1.0 · พ.ค. 2569 · TRPB อยู่บน TRON Nile testnet (ทดสอบ
            ไม่ใช่เงินจริง)
          </p>
        </div>
      </div>
    </div>
  );
}
