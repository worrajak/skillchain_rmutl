import type { Metadata } from "next";
import { Geist_Mono, Noto_Serif_Thai, Sarabun } from "next/font/google";
import { Toaster } from "@/components/ui/sonner";
import { Navbar } from "@/components/navbar";
import { MobileTabBar } from "@/components/mobile-tab-bar";
import "./globals.css";

// Sarabun อ่านง่ายทั้งไทยและละติน — ใช้เป็น body
const sarabun = Sarabun({
  variable: "--font-geist-sans",
  subsets: ["thai", "latin"],
  weight: ["300", "400", "600", "700"],
});

// Noto Serif Thai ใช้เฉพาะหัวเรื่อง ให้น้ำหนักแบบเอกสารทางการ
const notoSerifThai = Noto_Serif_Thai({
  variable: "--font-display",
  subsets: ["thai", "latin"],
  weight: ["500", "600", "700"],
});

// ตัวเลข/รหัส — ต้องเป็น monospace
const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "SkillChain มทร.ล้านนา",
  description:
    "ระบบจัดการงานจ้างนักศึกษาช่างบน TRON Blockchain พร้อมระบบ Escrow, NFT Credential และการฝึกทักษะแบบมีพี่เลี้ยง",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="th"
      className={`${sarabun.variable} ${notoSerifThai.variable} ${geistMono.variable} h-full antialiased`}
      style={{ fontFamily: "var(--font-geist-sans), sans-serif" }}
    >
      <body className="min-h-full flex flex-col">
        <Navbar />
        {children}
        <MobileTabBar />
        <Toaster />
      </body>
    </html>
  );
}
