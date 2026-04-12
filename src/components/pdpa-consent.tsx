"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Shield, ChevronDown, ChevronUp } from "lucide-react";

const PDPA_VERSION = "1.0";

interface PDPAConsentProps {
  accepted: boolean;
  onAccept: (version: string) => void;
}

export function PDPAConsent({ accepted, onAccept }: PDPAConsentProps) {
  const [expanded, setExpanded] = useState(false);

  return (
    <Card className="border-blue-200 bg-blue-50/30">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm flex items-center gap-2 text-foreground">
          <Shield className="size-4 text-blue-600" />
          นโยบายความเป็นส่วนตัว (PDPA)
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="text-xs text-muted-foreground space-y-1">
          <p>ระบบ SkillChain RMUTL จะเก็บรวบรวมข้อมูลส่วนบุคคลของท่านเพื่อวัตถุประสงค์ดังนี้:</p>
          <button
            type="button"
            onClick={() => setExpanded(!expanded)}
            className="flex items-center gap-1 text-blue-600 hover:underline"
          >
            {expanded ? "ย่อรายละเอียด" : "อ่านรายละเอียดเพิ่มเติม"}
            {expanded ? <ChevronUp className="size-3" /> : <ChevronDown className="size-3" />}
          </button>
        </div>

        {expanded && (
          <div className="text-xs text-muted-foreground space-y-2 bg-white rounded-lg p-3 border">
            <p><strong className="text-foreground">1. ข้อมูลที่เก็บรวบรวม:</strong></p>
            <ul className="list-disc pl-4 space-y-0.5">
              <li>ชื่อ-นามสกุล, อีเมล, รหัสนักศึกษา/อาจารย์</li>
              <li>คณะ/สาขา, วิทยาเขต, ชั้นปี</li>
              <li>ข้อมูลหน่วยงาน (สำหรับผู้ว่าจ้าง/ผู้บริจาค)</li>
              <li>ที่อยู่กระเป๋าเงินดิจิทัล (Wallet Address)</li>
              <li>ข้อมูลตำแหน่งที่ตั้ง (เฉพาะเมื่อเช็คอิน)</li>
              <li>รูปภาพที่อัปโหลดในระบบ</li>
            </ul>
            <p><strong className="text-foreground">2. วัตถุประสงค์:</strong></p>
            <ul className="list-disc pl-4 space-y-0.5">
              <li>การจับคู่งานและบริหารจัดการสัญญาจ้างงาน</li>
              <li>การประเมินทักษะและออกใบรับรองวิชาชีพ</li>
              <li>การฝึกอบรมและพัฒนาทักษะ</li>
              <li>การแจ้งเตือนผ่านระบบและ Telegram</li>
              <li>การจัดการกองทุนบริจาคและ Escrow</li>
            </ul>
            <p><strong className="text-foreground">3. การเปิดเผยข้อมูล:</strong></p>
            <ul className="list-disc pl-4 space-y-0.5">
              <li>ชื่อ, วิทยาเขต, ระดับ Credential จะแสดงให้ผู้ว่าจ้างเห็น</li>
              <li>ผลประเมินจะแสดงเฉพาะเจ้าของและเจ้าหน้าที่</li>
              <li>จะไม่เปิดเผยข้อมูลต่อบุคคลภายนอกโดยไม่ได้รับอนุญาต</li>
            </ul>
            <p><strong className="text-foreground">4. สิทธิของเจ้าของข้อมูล:</strong></p>
            <ul className="list-disc pl-4 space-y-0.5">
              <li>สิทธิในการเข้าถึง แก้ไข ลบ และขอสำเนาข้อมูล</li>
              <li>สิทธิในการถอนความยินยอม (อาจส่งผลต่อการใช้งานบางส่วน)</li>
              <li>ติดต่อ: skillchain@rmutl.ac.th</li>
            </ul>
            <p className="text-[10px] text-muted-foreground mt-2">เวอร์ชัน {PDPA_VERSION} — ตาม พ.ร.บ. คุ้มครองข้อมูลส่วนบุคคล พ.ศ. 2562</p>
          </div>
        )}

        <label className="flex items-start gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={accepted}
            onChange={() => !accepted && onAccept(PDPA_VERSION)}
            className="mt-0.5 size-4 rounded border-gray-300"
            disabled={accepted}
          />
          <span className="text-xs text-foreground">
            ข้าพเจ้ายินยอมให้เก็บรวบรวม ใช้ และเปิดเผยข้อมูลส่วนบุคคลตามนโยบายข้างต้น
          </span>
        </label>
      </CardContent>
    </Card>
  );
}
