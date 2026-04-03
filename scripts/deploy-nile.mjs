/**
 * Deploy TRPBToken + JobEscrow to TRON Nile Testnet
 *
 * Usage:
 *   1. ขอ TRX จาก Nile Faucet: https://nile.tronscan.org/#/wallet/new
 *   2. ใส่ private key ใน .env.local:  TRON_DEPLOYER_PRIVATE_KEY=...
 *   3. รัน:  node scripts/deploy-nile.mjs
 */

import { TronWeb } from "tronweb";
import { execSync } from "child_process";
import { readFileSync, writeFileSync, existsSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..");

// --- Load .env.local ---
function loadEnv() {
  const envPath = resolve(ROOT, ".env.local");
  if (!existsSync(envPath)) {
    console.error("❌ ไม่พบ .env.local — สร้างไฟล์แล้วใส่ TRON_DEPLOYER_PRIVATE_KEY");
    process.exit(1);
  }
  const lines = readFileSync(envPath, "utf-8").split("\n");
  for (const line of lines) {
    const m = line.match(/^([^#=]+)=(.*)$/);
    if (m) process.env[m[1].trim()] = m[2].trim();
  }
}

loadEnv();

const PRIVATE_KEY = process.env.TRON_DEPLOYER_PRIVATE_KEY;
if (!PRIVATE_KEY) {
  console.error("❌ ไม่พบ TRON_DEPLOYER_PRIVATE_KEY ใน .env.local");
  console.error("   1. สร้าง wallet ที่ https://nile.tronscan.org/#/wallet/new");
  console.error("   2. ขอ TRX จาก faucet");
  console.error("   3. เพิ่ม TRON_DEPLOYER_PRIVATE_KEY=<your-private-key> ใน .env.local");
  process.exit(1);
}

const NILE_HOST = "https://nile.trongrid.io";
const tronWeb = new TronWeb({ fullHost: NILE_HOST, privateKey: PRIVATE_KEY });

const deployerAddress = tronWeb.address.fromPrivateKey(PRIVATE_KEY);
console.log(`\n🔑 Deployer: ${deployerAddress}`);
console.log(`🌐 Network: Nile Testnet\n`);

// --- Compile Solidity ---
function compile(contractFile) {
  const contractPath = resolve(ROOT, "contracts", contractFile);
  const contractName = contractFile.replace(".sol", "");
  const outDir = resolve(ROOT, ".solc-output");
  console.log(`📝 Compiling ${contractFile}...`);

  execSync(`mkdir -p "${outDir}"`);
  execSync(
    `npx solc --optimize --abi --bin -o "${outDir}" "${contractPath}"`,
    { encoding: "utf-8", maxBuffer: 10 * 1024 * 1024 }
  );

  // solcjs outputs files like: contracts_TRPBToken_sol_TRPBToken.abi
  const files = execSync(`ls "${outDir}"`, { encoding: "utf-8" }).trim().split("\n");
  // Match exact contract name (e.g. _JobEscrow.abi, not _ITRC20.abi)
  const suffix = `_${contractName}.`;
  const abiFile = files.find((f) => f.includes(suffix) && f.endsWith(".abi"));
  const binFile = files.find((f) => f.includes(suffix) && f.endsWith(".bin"));
  if (!abiFile || !binFile) throw new Error(`Compiled files for ${contractName} not found in: ${files.join(", ")}`);

  const abi = JSON.parse(readFileSync(resolve(outDir, abiFile), "utf-8"));
  const bytecode = readFileSync(resolve(outDir, binFile), "utf-8");

  return { abi, bytecode };
}

// --- Deploy Contract ---
async function deploy(name, abi, bytecode, params = []) {
  console.log(`🚀 Deploying ${name}...`);

  const tx = await tronWeb.transactionBuilder.createSmartContract(
    {
      abi,
      bytecode,
      feeLimit: 1_000_000_000, // 1000 TRX
      callValue: 0,
      parameters: params,
    },
    deployerAddress
  );

  const signed = await tronWeb.trx.sign(tx, PRIVATE_KEY);
  const receipt = await tronWeb.trx.sendRawTransaction(signed);

  if (!receipt.result) {
    throw new Error(`Deploy failed: ${JSON.stringify(receipt)}`);
  }

  const txId = receipt.txid;
  console.log(`   TX: ${txId}`);

  // Wait for confirmation
  console.log("   ⏳ Waiting for confirmation...");
  let contractAddress = null;
  for (let i = 0; i < 30; i++) {
    await new Promise((r) => setTimeout(r, 3000));
    try {
      const info = await tronWeb.trx.getTransactionInfo(txId);
      if (info && info.contract_address) {
        contractAddress = tronWeb.address.fromHex(info.contract_address);
        break;
      }
    } catch {
      // not confirmed yet
    }
  }

  if (!contractAddress) {
    throw new Error("Timeout waiting for contract deployment confirmation");
  }

  console.log(`   ✅ ${name}: ${contractAddress}`);
  console.log(`   🔗 https://nile.tronscan.org/#/contract/${contractAddress}\n`);
  return contractAddress;
}

// --- Main ---
async function main() {
  // Check balance
  const balance = await tronWeb.trx.getBalance(deployerAddress);
  const balanceTRX = balance / 1_000_000;
  console.log(`💰 Balance: ${balanceTRX} TRX`);
  if (balanceTRX < 100) {
    console.error("❌ TRX ไม่พอ — ขอ TRX จาก Nile Faucet: https://nile.tronscan.org/#/wallet/new");
    process.exit(1);
  }
  console.log("");

  // 1. Compile
  const trpb = compile("TRPBToken.sol");
  const escrow = compile("JobEscrow.sol");

  // 2. TRPBToken — already deployed
  const trpbAddress = "TAj5Fy9GHSG4h6FuyHt9BLEDyFmqqPyFBt";
  console.log(`✅ TRPBToken (existing): ${trpbAddress}\n`);

  // 3. Deploy JobEscrow (token = TRPB, fund = deployer, staff = deployer)
  //    ใน production จะเปลี่ยน fund/staff wallet ภายหลัง
  const escrowAddress = await deploy("JobEscrow", escrow.abi, escrow.bytecode, [
    trpbAddress,
    deployerAddress, // fundWallet (ชั่วคราว)
    deployerAddress, // staffWallet (ชั่วคราว)
  ]);

  // 4. Save ABIs
  const abiDir = resolve(ROOT, "src", "lib", "tron", "abi");
  execSync(`mkdir -p "${abiDir}"`);
  writeFileSync(resolve(abiDir, "TRPBToken.json"), JSON.stringify(trpb.abi, null, 2));
  writeFileSync(resolve(abiDir, "JobEscrow.json"), JSON.stringify(escrow.abi, null, 2));
  console.log("📄 ABIs saved to src/lib/tron/abi/\n");

  // 5. Update .env.local
  const envPath = resolve(ROOT, ".env.local");
  let envContent = readFileSync(envPath, "utf-8");

  const envUpdates = {
    NEXT_PUBLIC_TRPB_TOKEN_ADDRESS: trpbAddress,
    NEXT_PUBLIC_JOB_ESCROW_ADDRESS: escrowAddress,
    NEXT_PUBLIC_TRON_FULL_HOST: NILE_HOST,
    NEXT_PUBLIC_TRON_NETWORK: "nile",
  };

  for (const [key, value] of Object.entries(envUpdates)) {
    const regex = new RegExp(`^${key}=.*$`, "m");
    if (regex.test(envContent)) {
      envContent = envContent.replace(regex, `${key}=${value}`);
    } else {
      envContent += `\n${key}=${value}`;
    }
  }

  writeFileSync(envPath, envContent);
  console.log("📝 Updated .env.local with contract addresses\n");

  // 6. Summary
  console.log("═══════════════════════════════════════════════════");
  console.log("  SkillChain — TRON Nile Testnet Deploy Complete");
  console.log("═══════════════════════════════════════════════════");
  console.log(`  Deployer:     ${deployerAddress}`);
  console.log(`  TRPBToken:    ${trpbAddress}`);
  console.log(`  JobEscrow:    ${escrowAddress}`);
  console.log(`  Initial TRPB: ${INITIAL_SUPPLY.toLocaleString()} TRPB`);
  console.log("═══════════════════════════════════════════════════");
  console.log("\n⚠️  อย่าลืมอัปเดต Vercel Environment Variables:");
  console.log(`  NEXT_PUBLIC_TRPB_TOKEN_ADDRESS=${trpbAddress}`);
  console.log(`  NEXT_PUBLIC_JOB_ESCROW_ADDRESS=${escrowAddress}`);
  console.log(`  NEXT_PUBLIC_TRON_FULL_HOST=${NILE_HOST}`);
  console.log(`  NEXT_PUBLIC_TRON_NETWORK=nile`);
}

main().catch((err) => {
  console.error("❌ Deploy failed:", err.message);
  process.exit(1);
});
