/**
 * สร้าง TRON Wallet สำหรับ Nile Testnet
 * รัน: node scripts/create-wallet.mjs
 */

import { TronWeb } from "tronweb";

const tronWeb = new TronWeb({ fullHost: "https://nile.trongrid.io" });

const account = await tronWeb.createAccount();

console.log("═══════════════════════════════════════════════════");
console.log("  TRON Wallet สำหรับ Nile Testnet");
console.log("═══════════════════════════════════════════════════");
console.log(`  Address:     ${account.address.base58}`);
console.log(`  Private Key: ${account.privateKey}`);
console.log("═══════════════════════════════════════════════════");
console.log("");
console.log("📋 ขั้นตอนถัดไป:");
console.log("  1. ขอ TRX ฟรี (ค่า gas) — เปิดลิงก์นี้ใน browser:");
console.log(`     https://nile.tronscan.org/#/wallet/new`);
console.log(`     → วาง Address ด้านบน → กด Request 2000 TRX`);
console.log("");
console.log("  2. เพิ่ม private key ใน .env.local:");
console.log(`     TRON_DEPLOYER_PRIVATE_KEY=${account.privateKey}`);
console.log("");
console.log("  3. Deploy contracts:");
console.log("     node scripts/deploy-nile.mjs");
console.log("");
console.log("⚠️  เก็บ Private Key ไว้อย่างปลอดภัย ห้ามแชร์!");
