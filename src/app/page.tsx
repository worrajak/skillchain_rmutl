import Link from "next/link";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

const features = [
  {
    title: "Job Board",
    description:
      "ค้นหาและรับงานซ่อมบำรุง 4 ประเภท: งานจ้าง, จิตอาสา, ฝึกทักษะ, ยกเว้นค่าบริการ",
    badge: "4 ประเภทงาน",
  },
  {
    title: "Escrow Payment",
    description:
      "ระบบวางเงินประกันบน Smart Contract จ่ายอัตโนมัติเมื่องานเสร็จ โปร่งใสตรวจสอบได้",
    badge: "TRON Blockchain",
  },
  {
    title: "Skill Credential (NFT)",
    description:
      "ใบรับรองทักษะช่างในรูปแบบ NFT บน Blockchain ที่แก้ไขย้อนหลังไม่ได้",
    badge: "NFT Certificate",
  },
  {
    title: "Mentorship",
    description:
      "ระบบพี่เลี้ยง — นักศึกษารุ่นพี่กำกับดูแลรุ่นน้องในงานฝึกทักษะ สะสม Points และ Badge",
    badge: "Trainee + Mentor",
  },
  {
    title: "Student Tier",
    description:
      "เส้นทางพัฒนา 3 ระดับ: Trainee \u2192 Apprentice \u2192 Certified Technician",
    badge: "3 Levels",
  },
  {
    title: "Donation Fund",
    description:
      "กองทุนบริจาคโปร่งใส ผู้บริจาคติดตามการใช้เงินแบบ Real-time ผ่าน Blockchain",
    badge: "Transparent",
  },
];

export default function HomePage() {
  return (
    <div className="flex flex-col min-h-screen">
      {/* Hero */}
      <header className="bg-gradient-to-br from-blue-600 to-indigo-800 text-white">
        <div className="max-w-6xl mx-auto px-4 py-20 text-center">
          <Badge variant="secondary" className="mb-4 text-sm">
            Pilot Phase — มทร.ล้านนา 2569
          </Badge>
          <h1 className="text-4xl md:text-5xl font-bold mb-4">
            SkillChain มทร.ล้านนา
          </h1>
          <p className="text-lg md:text-xl text-blue-100 max-w-2xl mx-auto mb-8">
            ระบบจัดการงานจ้างนักศึกษาช่างบน TRON Blockchain
            <br />
            พร้อมระบบ Escrow, NFT Credential และการฝึกทักษะแบบมีพี่เลี้ยง
          </p>
          <div className="flex gap-4 justify-center">
            <Link href="/login">
              <Button size="lg" variant="secondary">
                เข้าสู่ระบบ
              </Button>
            </Link>
            <Link href="/register">
              <Button
                size="lg"
                variant="outline"
                className="text-white border-white hover:bg-white/10"
              >
                ลงทะเบียน
              </Button>
            </Link>
          </div>
        </div>
      </header>

      {/* Features */}
      <main className="flex-1 max-w-6xl mx-auto px-4 py-16">
        <h2 className="text-2xl font-bold text-center mb-10">
          ความสามารถหลักของระบบ
        </h2>
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {features.map((f) => (
            <Card key={f.title}>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="text-lg">{f.title}</CardTitle>
                  <Badge variant="outline" className="text-xs">
                    {f.badge}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent>
                <CardDescription className="text-sm leading-relaxed">
                  {f.description}
                </CardDescription>
              </CardContent>
            </Card>
          ))}
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t py-8 text-center text-sm text-muted-foreground">
        <p>
          กลุ่มใต้ร่มพระบารมี — มหาวิทยาลัยเทคโนโลยีราชมงคลล้านนา
        </p>
        <p className="mt-1">
          Powered by Next.js, Supabase &amp; TRON Blockchain
        </p>
      </footer>
    </div>
  );
}
