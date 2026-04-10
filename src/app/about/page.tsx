import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import {
  ArrowLeft, ArrowRight, UserPlus, FileCheck, Wrench, Star, BadgeCheck,
  Shield, Award, Users, Wallet, Zap, Briefcase, Coins, ExternalLink, Database,
  GraduationCap, ClipboardCheck, Search, BookOpen,
} from "lucide-react";
import { CONTRACTS, TRON_CONFIG, TRPB_TOKEN } from "@/lib/tron/client";

async function getOnChainData() {
  try {
    const tokenAddr = CONTRACTS.TRPB_TOKEN;
    if (!tokenAddr) return null;

    const host = TRON_CONFIG.fullHost;
    const deployerAddr = "TU7VbEyrdZMmfMAqsNUmjmcG4CMBLtK7qj";
    // Deployer hex address (without 41 prefix, padded to 32 bytes)
    const deployerHexParam = "000000000000000000000000c703709d70258382fa33a872e1dd6cc303af84ac";

    // Call totalSupply() + balanceOf(deployer) in parallel
    const [supplyRes, balanceRes] = await Promise.all([
      fetch(`${host}/wallet/triggerconstantcontract`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          owner_address: deployerAddr,
          contract_address: tokenAddr,
          function_selector: "totalSupply()",
          parameter: "",
          visible: true,
        }),
        next: { revalidate: 60 },
      }),
      fetch(`${host}/wallet/triggerconstantcontract`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          owner_address: deployerAddr,
          contract_address: tokenAddr,
          function_selector: "balanceOf(address)",
          parameter: deployerHexParam,
          visible: true,
        }),
        next: { revalidate: 60 },
      }),
    ]);

    const supplyData = await supplyRes.json();
    const balData = await balanceRes.json();

    const totalSupply = parseInt(supplyData?.constant_result?.[0] || "0", 16) / 10 ** TRPB_TOKEN.decimals;
    const deployerBalance = parseInt(balData?.constant_result?.[0] || "0", 16) / 10 ** TRPB_TOKEN.decimals;

    return { totalSupply, deployerBalance, deployerAddr };
  } catch {
    return null;
  }
}

export default async function AboutPage() {
  const onChain = await getOnChainData();
  return (
    <div className="min-h-screen bg-muted">
      <header className="bg-card border-b">
        <div className="max-w-5xl mx-auto px-4 py-3 flex items-center gap-3">
          <Link href="/"><Button variant="ghost" size="sm"><ArrowLeft className="size-4 mr-1" />กลับหน้าหลัก</Button></Link>
          <span className="text-sm text-muted-foreground">เกี่ยวกับระบบ SkillChain</span>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-10 space-y-14">
        {/* How It Works */}
        <section>
          <h2 className="text-2xl font-bold text-center mb-2 text-foreground">ขั้นตอนการใช้งาน</h2>
          <p className="text-sm text-muted-foreground text-center mb-8">เส้นทางพัฒนาจากนักศึกษาช่างสู่ช่างชำนาญการ</p>
          <div className="grid md:grid-cols-5 gap-3">
            {[
              { step: 1, icon: UserPlus, title: "ลงทะเบียน", desc: "สมัครบัญชี เลือกบทบาท", color: "from-gray-500 to-gray-600" },
              { step: 2, icon: FileCheck, title: "ผ่านฝึกอบรม", desc: "อบรมจากใต้ร่มพระบารมี", color: "from-amber-500 to-orange-600" },
              { step: 3, icon: Wrench, title: "รับงาน", desc: "งานฝึก/จิตอาสา/จ้าง", color: "from-blue-500 to-indigo-600" },
              { step: 4, icon: Star, title: "ถูกประเมิน", desc: "อาจารย์+ผู้จ้าง+Mentor", color: "from-yellow-500 to-amber-600" },
              { step: 5, icon: BadgeCheck, title: "NFT Credential", desc: "ใบรับรองบน Blockchain", color: "from-green-500 to-emerald-600" },
            ].map((s, i) => (
              <div key={s.step} className="flex flex-col items-center text-center">
                <div className={cn("flex size-14 items-center justify-center rounded-2xl bg-gradient-to-br text-white mb-3 shadow-lg", s.color)}>
                  <s.icon className="size-7" />
                </div>
                <div className="font-bold text-sm text-foreground mb-1"><span className="text-muted-foreground">{s.step}.</span> {s.title}</div>
                <p className="text-xs text-muted-foreground">{s.desc}</p>
                {i < 4 && <ArrowRight className="size-4 text-muted-foreground/40 mt-2 hidden md:block" />}
              </div>
            ))}
          </div>
        </section>

        {/* TRPB On-Chain Info */}
        <section>
          <h2 className="text-2xl font-bold text-center mb-2 text-foreground">TRPB Coin — On-Chain</h2>
          <p className="text-sm text-muted-foreground text-center mb-6">ข้อมูลเหรียญ TRPB บน TRON {TRON_CONFIG.network === "nile" ? "Nile Testnet" : "Mainnet"} แบบ Real-time</p>

          <div className="grid md:grid-cols-3 gap-4 mb-4">
            <Card className="bg-gradient-to-br from-yellow-50 to-amber-50 border-yellow-200">
              <CardContent className="pt-4 pb-4 text-center space-y-1">
                <Coins className="size-8 mx-auto text-yellow-600" />
                <div className="text-2xl font-bold text-foreground">1 TRPB = 1 อาสา</div>
                <div className="text-xs text-muted-foreground">อัตราคงที่ กำหนดโดยคณะทำงาน</div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4 pb-4 text-center space-y-1">
                <Database className="size-8 mx-auto text-blue-600" />
                <div className="text-2xl font-bold text-foreground">
                  {onChain ? onChain.totalSupply.toLocaleString() : "1,000,000"} <span className="text-base font-normal text-muted-foreground">TRPB</span>
                </div>
                <div className="text-xs text-muted-foreground">Total Supply (on-chain)</div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4 pb-4 text-center space-y-1">
                <Wallet className="size-8 mx-auto text-green-600" />
                <div className="text-2xl font-bold text-foreground">
                  {onChain ? onChain.deployerBalance.toLocaleString() : "-"} <span className="text-base font-normal text-muted-foreground">TRPB</span>
                </div>
                <div className="text-xs text-muted-foreground">คงเหลือใน Treasury</div>
              </CardContent>
            </Card>
          </div>

          {/* Contract Addresses */}
          <Card>
            <CardContent className="pt-4 pb-4 space-y-3">
              <div className="text-sm font-semibold text-foreground mb-2">Smart Contract Addresses</div>
              {[
                { label: "TRPB Token", addr: CONTRACTS.TRPB_TOKEN, type: "contract" as const },
                { label: "Job Escrow", addr: CONTRACTS.JOB_ESCROW, type: "contract" as const },
                { label: "Treasury Wallet", addr: "TU7VbEyrdZMmfMAqsNUmjmcG4CMBLtK7qj", type: "address" as const },
              ].map((c) => (
                <div key={c.label} className="flex items-center justify-between gap-2 rounded-lg bg-muted/50 px-3 py-2">
                  <div>
                    <div className="text-xs text-muted-foreground">{c.label}</div>
                    <div className="text-xs font-mono text-foreground break-all">{c.addr || "ยังไม่ได้ตั้งค่า"}</div>
                  </div>
                  {c.addr && (
                    <a
                      href={`https://${TRON_CONFIG.network === "nile" ? "nile." : ""}tronscan.org/#/${c.type}/${c.addr}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="shrink-0 text-blue-600 hover:text-blue-800"
                    >
                      <ExternalLink className="size-4" />
                    </a>
                  )}
                </div>
              ))}
              <div className="flex items-center gap-1.5 mt-2">
                <span className="size-2 rounded-full bg-green-500 animate-pulse" />
                <span className="text-xs text-muted-foreground">TRON {TRON_CONFIG.network === "nile" ? "Nile Testnet" : "Mainnet"} — ข้อมูลอัปเดตทุก 60 วินาที</span>
              </div>
            </CardContent>
          </Card>
        </section>

        {/* Training System */}
        <section>
          <h2 className="text-2xl font-bold text-center mb-2 text-foreground">ระบบฝึกอบรมทักษะช่าง</h2>
          <p className="text-sm text-muted-foreground text-center mb-6">Reskill · Upskill · New Skill — เปิดรับทั้งนักศึกษาและบุคคลภายนอก</p>
          <div className="grid md:grid-cols-4 gap-3">
            {[
              { icon: GraduationCap, title: "หลักสูตรอบรม", desc: "สร้างหลักสูตรพร้อมโมดูลการเรียนรู้ กำหนดเกณฑ์ผ่านแต่ละหัวข้อ", color: "text-indigo-600", bg: "bg-indigo-50" },
              { icon: UserPlus, title: "ลงทะเบียนภายนอก", desc: "บุคคลทั่วไปสมัครเรียนได้ทันที ไม่ต้องรอ admin อนุมัติ", color: "text-green-600", bg: "bg-green-50" },
              { icon: ClipboardCheck, title: "ประเมินรายโมดูล", desc: "อาจารย์/คณะทำงานประเมินผ่าน-ไม่ผ่าน พร้อมคะแนนและหมายเหตุ", color: "text-orange-600", bg: "bg-orange-50" },
              { icon: Search, title: "ตรวจสอบใบรับรอง", desc: "ผ่านครบทุกโมดูล → ออกใบรับรองอัตโนมัติ ตรวจสอบได้แบบสาธารณะ", color: "text-purple-600", bg: "bg-purple-50" },
            ].map((f) => (
              <Card key={f.title}>
                <CardContent className="pt-4 pb-4 text-center space-y-2">
                  <div className={cn("flex size-12 items-center justify-center rounded-xl mx-auto", f.bg)}>
                    <f.icon className={cn("size-6", f.color)} />
                  </div>
                  <div className="font-semibold text-sm text-foreground">{f.title}</div>
                  <p className="text-xs text-muted-foreground">{f.desc}</p>
                </CardContent>
              </Card>
            ))}
          </div>
          <div className="flex justify-center gap-3 mt-6">
            <Link href="/training"><Button variant="outline" size="sm"><BookOpen className="size-4 mr-1" />ดูหลักสูตรทั้งหมด</Button></Link>
            <Link href="/register-trainee"><Button size="sm" className="bg-indigo-600 hover:bg-indigo-700"><GraduationCap className="size-4 mr-1" />สมัครผู้เรียนภายนอก</Button></Link>
            <Link href="/verify"><Button variant="outline" size="sm"><Search className="size-4 mr-1" />ตรวจสอบใบรับรอง</Button></Link>
          </div>
        </section>

        {/* 5 Credential Levels */}
        <section>
          <h2 className="text-2xl font-bold text-center mb-2 text-foreground">5 ระดับ Credential</h2>
          <p className="text-sm text-muted-foreground text-center mb-6">ใบรับรองทักษะช่างบน Blockchain — ยิ่งระดับสูง ยิ่งรับงานได้มาก</p>
          <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
            {[
              { lv: 1, name: "Registered", th: "ลงทะเบียน", by: "ระบบอัตโนมัติ", jobs: "สังเกตการณ์", gradient: "from-gray-400 to-gray-500", ring: "ring-gray-300" },
              { lv: 2, name: "Project Cert.", th: "ผ่านฝึกอบรม", by: "กลุ่มใต้ร่มพระบารมี", jobs: "ฝึกทักษะ+จิตอาสา", gradient: "from-amber-500 to-orange-600", ring: "ring-amber-300" },
              { lv: 3, name: "Teacher Cert.", th: "อาจารย์รับรอง", by: "มทร.ล้านนา", jobs: "งานจ้างได้", gradient: "from-blue-500 to-indigo-600", ring: "ring-blue-300" },
              { lv: 4, name: "National Cert.", th: "สถาบันชาติรับรอง", by: "กรมฝีมือแรงงาน/สคช.", jobs: "ทุกประเภท+Mentor", gradient: "from-yellow-400 to-amber-500", ring: "ring-yellow-400" },
              { lv: 5, name: "Master Tech.", th: "ช่างชำนาญการ", by: "ผลงานสะสม", jobs: "รับเหมา+สอน+รับรอง", gradient: "from-purple-500 to-fuchsia-600", ring: "ring-purple-400" },
            ].map((c) => (
              <Card key={c.lv} className={cn("overflow-hidden ring-1", c.ring)}>
                <div className={cn("h-2 bg-gradient-to-r", c.gradient)} />
                <CardContent className="pt-3 pb-3 text-center space-y-1">
                  <div className={cn("inline-flex size-10 items-center justify-center rounded-full bg-gradient-to-br text-white font-bold text-sm mx-auto", c.gradient)}>{c.lv}</div>
                  <div className="font-bold text-sm text-foreground">{c.name}</div>
                  <div className="text-xs text-muted-foreground">{c.th}</div>
                  <div className="text-[10px] text-muted-foreground border-t pt-1 mt-1">รับรอง: {c.by}</div>
                  <div className="text-[10px] font-medium text-foreground">{c.jobs}</div>
                </CardContent>
              </Card>
            ))}
          </div>
        </section>

        {/* สำหรับใคร */}
        <section>
          <h2 className="text-2xl font-bold text-center mb-6 text-foreground">สำหรับใคร?</h2>
          <div className="grid md:grid-cols-2 gap-4">
            {[
              { role: "นักศึกษาช่าง", desc: "รับงาน สร้างประวัติ ได้ NFT ใบรับรอง", icon: Users, color: "text-blue-600", bg: "bg-blue-50" },
              { role: "ผู้ว่าจ้าง/หน่วยงาน", desc: "ลงงาน จ่ายผ่าน Escrow ประเมินช่างได้", icon: Briefcase, color: "text-green-600", bg: "bg-green-50" },
              { role: "อาจารย์", desc: "ประเมินทักษะ ดูแลคุณภาพ เลื่อนระดับ สร้างงานจ้างเทียม", icon: Award, color: "text-orange-600", bg: "bg-orange-50" },
              { role: "คณะทำงานใต้ร่มพระบารมี", desc: "ฝึกอบรม ประเมินเบื้องต้น รับรอง Lv.2 ยืนยันผู้ใช้ กำกับดูแลคุณภาพ", icon: Shield, color: "text-purple-600", bg: "bg-purple-50" },
              { role: "คณะทำงาน มทร.ล้านนา", desc: "ผู้ว่าจ้างเทียม+ผู้ประเมินทักษะ สร้างงานทดสอบ", icon: Wrench, color: "text-indigo-600", bg: "bg-indigo-50" },
              { role: "ผู้เรียนภายนอก (Trainee)", desc: "สมัครอบรม Reskill/Upskill/New Skill ได้ทันที ผ่านแล้วได้ใบรับรองบน Blockchain", icon: GraduationCap, color: "text-indigo-600", bg: "bg-indigo-50" },
              { role: "ผู้บริจาค", desc: "บริจาคกองทุน ติดตามการใช้เงินแบบ Real-time บน Blockchain", icon: Wallet, color: "text-pink-600", bg: "bg-pink-50" },
            ].map((r) => (
              <Card key={r.role}>
                <CardContent className="flex items-start gap-3 pt-4 pb-4">
                  <div className={cn("flex size-10 shrink-0 items-center justify-center rounded-xl", r.bg)}>
                    <r.icon className={cn("size-5", r.color)} />
                  </div>
                  <div>
                    <div className="font-semibold text-sm text-foreground">{r.role}</div>
                    <div className="text-xs text-muted-foreground mt-0.5">{r.desc}</div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </section>

        {/* Features */}
        <section>
          <h2 className="text-2xl font-bold text-center mb-6 text-foreground">ระบบครบวงจร</h2>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            {[
              { icon: Briefcase, title: "Job Board", desc: "4 ประเภทงาน + คณะทำงานกำกับ" },
              { icon: Wallet, title: "Escrow Payment", desc: "จ่ายผ่าน Smart Contract อัตโนมัติ" },
              { icon: Award, title: "NFT Credential", desc: "ใบรับรอง 5 ระดับ แก้ไขไม่ได้" },
              { icon: Users, title: "Mentorship", desc: "พี่เลี้ยงดูแล + ประเมิน" },
              { icon: Shield, title: "Dispute Resolution", desc: "ข้อพิพาท คณะทำงานตัดสิน" },
              { icon: Zap, title: "Chat + Agreement", desc: "เจรจา + ข้อตกลงบันทึกบน Chain" },
              { icon: GraduationCap, title: "Training System", desc: "หลักสูตรอบรม + ประเมินรายโมดูล + ใบรับรอง" },
              { icon: ClipboardCheck, title: "Job Review", desc: "คณะทำงานพิจารณาค่าตอบแทนก่อนเปิดงาน" },
              { icon: Search, title: "Certificate Verify", desc: "ตรวจสอบใบรับรองอบรมแบบสาธารณะ" },
            ].map((f) => (
              <Card key={f.title}>
                <CardContent className="flex items-center gap-3 pt-4 pb-4">
                  <f.icon className="size-6 text-blue-600 shrink-0" />
                  <div>
                    <div className="font-semibold text-sm text-foreground">{f.title}</div>
                    <div className="text-xs text-muted-foreground">{f.desc}</div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </section>

        {/* CTA */}
        <section className="text-center">
          <div className="flex flex-wrap gap-3 justify-center">
            <Link href="/register"><Button size="lg" className="font-semibold px-8">ลงทะเบียนนักศึกษา</Button></Link>
            <Link href="/register-trainee"><Button size="lg" className="font-semibold px-8 bg-indigo-600 hover:bg-indigo-700">สมัครผู้เรียนภายนอก</Button></Link>
            <Link href="/training"><Button size="lg" variant="outline" className="font-semibold px-8">ดูหลักสูตรอบรม</Button></Link>
            <Link href="/"><Button size="lg" variant="outline" className="font-semibold px-8">กลับหน้าหลัก</Button></Link>
          </div>
        </section>
      </main>
    </div>
  );
}
