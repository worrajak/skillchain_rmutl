import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    rules: {
      // ห้าม <SelectValue /> ที่ไม่มี placeholder
      //
      // Base UI ใส่ SelectContent ไว้ใน portal รายการตัวเลือกจึงยังไม่ถูก
      // ลงทะเบียนตอน render แรก SelectValue ที่ไม่มีอะไรเลยจึงแสดง "ค่าดิบ"
      // ที่เก็บอยู่ เช่น student · huaykaew · PAID · electrical แทนชื่อไทย
      //
      // บั๊กนี้ทำให้อาจารย์ในโครงการ 2 ท่านลงทะเบียนเป็นนักศึกษาและใช้งาน
      // ไม่ได้นาน 2 เดือน (ดู UX-Fix-Log-2569-08 ใน vault)
      //
      // ให้เขียนป้ายกำกับลงใน SelectTrigger ตรง ๆ แทน:
      //   <SelectTrigger>{getJobTypeLabel(jobType)}</SelectTrigger>
      // label map ใช้ร่วมอยู่ที่ src/types/database.ts
      //
      // <SelectValue placeholder="..." /> ยังใช้ได้ เพราะช่องที่ยังไม่ได้
      // เลือกจะแสดง placeholder และเมื่อเลือกแล้วรายการถูกลงทะเบียนแล้ว
      "no-restricted-syntax": [
        "error",
        {
          selector:
            "JSXElement[openingElement.name.name='SelectValue']:not(:has(JSXAttribute[name.name='placeholder']))",
          message:
            "SelectValue ที่ไม่มี placeholder จะแสดงค่าดิบแทนป้ายกำกับ — เขียน label ลงใน SelectTrigger แทน เช่น <SelectTrigger>{getJobTypeLabel(v)}</SelectTrigger> (label map อยู่ที่ src/types/database.ts)",
        },
      ],
    },
  },
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
  ]),
]);

export default eslintConfig;
