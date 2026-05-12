"use client";

/**
 * 1-page A4 guide for a role.
 *
 * Used both as:
 *   - a public preview URL (e.g. /guides/student/preview)
 *   - the source HTML that Playwright captures and turns into a PDF
 *
 * Print rules (CSS):
 *   - @page { size: A4 portrait; margin: 8mm; }
 *   - Big body text (11-16pt) so it's readable on phone + paper
 */

import { notFound } from "next/navigation";
import { use } from "react";
import { getGuide } from "@/lib/guides-content";

interface Params { role: string }

export default function GuidePreviewPage({ params }: { params: Promise<Params> }) {
  const { role } = use(params);
  const guide = getGuide(role);
  if (!guide) return notFound();

  return (
    <>
      {/* Print/screen styles + Thai font via Google Fonts */}
      <style dangerouslySetInnerHTML={{ __html: `
        @import url('https://fonts.googleapis.com/css2?family=Sarabun:wght@400;600;700;800&display=swap');
        @page { size: A4 portrait; margin: 0; }
        html, body { margin: 0; padding: 0; }
        /* Hide global chrome (navbar + bottom tab + flex layout) on guide pages */
        body > nav, body > section, body > div.md\\:hidden { display: none !important; }
        body { display: block !important; }
        .guide-root {
          font-family: 'Sarabun', 'TH Sarabun New', system-ui, sans-serif;
          color: #111827;
          background: #fff;
          width: 210mm;
          height: 297mm;
          padding: 7mm 7mm 5mm 7mm;
          box-sizing: border-box;
          overflow: hidden;
        }
        @media print {
          html, body { margin: 0; padding: 0; background: #fff; }
          .no-print { display: none !important; }
          .guide-root { box-shadow: none !important; margin: 0 !important; }
        }
        @media screen {
          body { background: #f3f4f6; padding: 24px 0; }
          .guide-root {
            margin: 0 auto;
            box-shadow: 0 6px 30px rgba(0,0,0,0.18);
          }
        }
      ` }} />

      {/* Browser-only "Print" hint */}
      <div className="no-print" style={{ position: "fixed", top: 12, right: 12, zIndex: 100 }}>
        <button
          onClick={() => window.print()}
          style={{
            padding: "10px 16px", borderRadius: 12, border: "none",
            background: "#0ea5e9", color: "#fff", fontWeight: 700,
            cursor: "pointer", fontSize: 14, boxShadow: "0 4px 12px rgba(0,0,0,0.2)",
          }}
        >
          🖨 พิมพ์ / บันทึก PDF
        </button>
      </div>

      <div className="guide-root">
        {/* Header */}
        <div style={{
          borderBottom: "2.5px solid #0ea5e9",
          paddingBottom: 5,
          marginBottom: 7,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
        }}>
          <div>
            <div style={{ fontSize: 10, color: "#64748b", letterSpacing: 0.5 }}>
              SkillChain RMUTL · คู่มือการใช้งาน
            </div>
            <div style={{ fontSize: 22, fontWeight: 800, color: "#0c4a6e", lineHeight: 1.1 }}>
              {guide.emoji} {guide.roleLabel}
            </div>
          </div>
          <div style={{ textAlign: "right", fontSize: 9, color: "#64748b" }}>
            <div>เวอร์ชั่น 1.0</div>
            <div>พ.ค. 2569</div>
          </div>
        </div>

        {/* Hero tagline */}
        <div style={{
          background: "linear-gradient(135deg, #f0f9ff, #e0f2fe)",
          borderLeft: "4px solid #0284c7",
          padding: "6px 10px",
          borderRadius: 5,
          marginBottom: 7,
        }}>
          <div style={{ fontSize: 10, color: "#0284c7", fontWeight: 700, marginBottom: 1 }}>
            🎯 ภารกิจของคุณ
          </div>
          <div style={{ fontSize: 14, fontWeight: 600, color: "#0c4a6e", lineHeight: 1.25 }}>
            {guide.tagline}
          </div>
          {guide.canCreateJobs && (
            <div style={{ fontSize: 9, color: "#0284c7", marginTop: 2, fontWeight: 600 }}>
              ✅ คุณสามารถสร้างงานให้ นศ. ทำได้
            </div>
          )}
        </div>

        {/* Steps grid (3 × 2) */}
        <div style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr 1fr",
          gap: 6,
          marginBottom: 8,
        }}>
          {guide.steps.map((step, i) => (
            <div key={i} style={{
              border: "1.5px solid #e2e8f0",
              borderRadius: 6,
              padding: 6,
              display: "flex",
              flexDirection: "column",
              gap: 4,
              background: "#fff",
            }}>
              <div style={{
                position: "relative",
                width: "100%",
                paddingBottom: "55%", // shorter aspect to fit 6 steps in 1 page
                background: "#f1f5f9",
                borderRadius: 4,
                overflow: "hidden",
              }}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={step.image}
                  alt={step.title}
                  style={{
                    position: "absolute",
                    inset: 0,
                    width: "100%",
                    height: "100%",
                    objectFit: "cover",
                    objectPosition: "top",
                  }}
                />
              </div>
              <div>
                <div style={{ fontSize: 12, fontWeight: 700, color: "#0c4a6e", lineHeight: 1.15 }}>
                  {step.title}
                </div>
                <div style={{ fontSize: 10, color: "#334155", lineHeight: 1.3, marginTop: 2 }}>
                  {step.body}
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Workflow callouts */}
        <div style={{
          background: "#fef3c7",
          border: "1.5px solid #fcd34d",
          borderRadius: 5,
          padding: "6px 10px",
          marginBottom: 8,
        }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: "#92400e", marginBottom: 2 }}>
            🔗 ความเชื่อมโยงกับ role อื่นในระบบ
          </div>
          <ul style={{ margin: 0, padding: 0, listStyle: "none" }}>
            {guide.workflowCallouts.map((c, i) => (
              <li key={i} style={{ fontSize: 10, color: "#78350f", lineHeight: 1.3 }}>
                ・ {c}
              </li>
            ))}
          </ul>
        </div>

        {/* Footer with QR codes */}
        <div style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr 1fr",
          gap: 8,
          alignItems: "center",
          borderTop: "1.5px solid #e2e8f0",
          paddingTop: 5,
        }}>
          <div style={{ textAlign: "center" }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={`/api/qr?text=${encodeURIComponent(process.env.NEXT_PUBLIC_APP_URL || "https://skillchain-rmutl.vercel.app")}&size=120`}
              alt="QR เข้าระบบ"
              style={{ width: 58, height: 58 }}
            />
            <div style={{ fontSize: 9, color: "#475569" }}>
              📱 เข้าระบบ
            </div>
          </div>
          <div style={{ fontSize: 9, color: "#64748b", lineHeight: 1.3 }}>
            <div style={{ fontWeight: 700, color: "#0c4a6e", fontSize: 10 }}>
              SkillChain RMUTL
            </div>
            <div>โครงการใต้ร่มพระบารมี · มทร.ล้านนา</div>
            <div>📧 worrajak@rmutl.ac.th</div>
            <div>🔗 skillchain-rmutl.vercel.app</div>
            <div style={{ marginTop: 1, color: "#94a3b8" }}>
              TRPB อยู่บน TRON Nile testnet
            </div>
          </div>
          <div style={{ textAlign: "center" }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={`/api/qr?text=${encodeURIComponent((process.env.NEXT_PUBLIC_APP_URL || "https://skillchain-rmutl.vercel.app") + "/guides/" + guide.slug + ".pdf")}&size=120`}
              alt="QR ดาวน์โหลด"
              style={{ width: 58, height: 58 }}
            />
            <div style={{ fontSize: 9, color: "#475569" }}>
              ⬇️ ดาวน์โหลด PDF
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
